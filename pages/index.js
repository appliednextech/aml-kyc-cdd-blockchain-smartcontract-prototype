import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import EddModal from "@/components/EddModal";
import { ensureSepolia, getReadContract, getWriteContract } from "@/utils/eth";
import { keccak256, toUtf8Bytes } from "ethers";

function normalizeName(s) {
  return (s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

async function fileToKeccak256(file) {
  if (!file) return "0x" + "0".repeat(64);
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  return keccak256(bytes);
}

export default function Home() {
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState({ type: "", msg: "" });

  const [form, setForm] = useState({
    customerId: "",
    fullName: "",
    homeAddress: "",
    identificationNumber: "",
    occupation: "",
    pep: "NO",
    expectedMonthlyUsd: "",
    expectedActivity: "",
  });

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [eddOpen, setEddOpen] = useState(false);
  const [eddAnswers, setEddAnswers] = useState({
    sourceOfIncome: "NO",
    siteVisit: "NO",
    familyScreening: "NO",
  });

  const [pendingRegisterPayload, setPendingRegisterPayload] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPep = form.pep === "YES";
  const expectedUsdNum = Number(form.expectedMonthlyUsd || 0);
  const isHighRisk = isPep || expectedUsdNum > 10000;

  const riskLabel = useMemo(() => {
    if (isHighRisk) return "High Risk (PEP and/or > 10,000 USD)";
    return "Standard Risk";
  }, [isHighRisk]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function connect() {
    try {
      if (!window.ethereum) throw new Error("MetaMask not detected. Please install MetaMask.");
      await ensureSepolia();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWallet(accounts?.[0] || "");
      setStatus({ type: "success", msg: "Connected to MetaMask (Sepolia)." });
    } catch (e) {
      setStatus({ type: "alert", msg: e?.message || "Failed to connect." });
    }
  }

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateBasics() {
    if (!form.customerId.trim()) return "Customer ID is required.";
    if (!form.fullName.trim()) return "Full name is required.";
    if (!form.homeAddress.trim()) return "Address is required.";
    if (!form.identificationNumber.trim()) return "Identification number is required.";
    if (!form.occupation.trim()) return "Occupation is required.";
    if (!form.expectedMonthlyUsd.toString().trim()) return "Expected transaction activity (USD) is required.";
    if (Number.isNaN(Number(form.expectedMonthlyUsd))) return "Expected transaction activity must be a number.";
    if (!form.expectedActivity.trim()) return "Expected transaction activity description is required.";
    if (!photo) return "Customer photo is required (we store only the photo hash on-chain).";
    return "";
  }

  async function checkDuplicate(customerId, fullName) {
    const c = await getReadContract();
    const exists = await c.isRegistered(customerId, fullName);
    return Boolean(exists);
  }

  async function startRegister() {
    setStatus({ type: "", msg: "" });
    try {
      const err = validateBasics();
      if (err) {
        setStatus({ type: "alert", msg: err });
        return;
      }

      await ensureSepolia();
      if (!wallet) await connect();

      const customerId = form.customerId.trim();
      const fullNameNorm = normalizeName(form.fullName);
      const dup = await checkDuplicate(customerId, fullNameNorm);
      if (dup) {
        setStatus({ type: "alert", msg: "Customer already registered (same Customer ID and name)." });
        return;
      }

      const photoHash = await fileToKeccak256(photo);

      const payload = {
        customerId,
        fullName: fullNameNorm,
        homeAddress: form.homeAddress.trim(),
        identificationNumber: form.identificationNumber.trim(),
        occupation: form.occupation.trim(),
        isPep,
        expectedMonthlyUsd: BigInt(Math.floor(Number(form.expectedMonthlyUsd))),
        expectedActivity: form.expectedActivity.trim(),
        photoHash,
      };

      if (isHighRisk) {
        // Ask for EDD checklist via modal
        setPendingRegisterPayload(payload);
        setEddOpen(true);
        setStatus({
          type: "notice",
          msg: "High-risk customer detected. Please complete the EDD checklist to proceed.",
        });
        return;
      }

      // Standard risk: register directly (EDD flags can remain false)
      await submitRegister(payload, {
        sourceOfIncomeCollected: false,
        siteVisitCompleted: false,
        familyAndAssociatesScreened: false,
      });
    } catch (e) {
      setStatus({ type: "alert", msg: e?.shortMessage || e?.message || "Registration failed." });
    }
  }

  async function submitRegister(payload, edd) {
    setIsSubmitting(true);
    try {
      const contract = await getWriteContract();

      const tx = await contract.registerCustomer(
        {
          customerId: payload.customerId,
          fullName: payload.fullName,
          homeAddress: payload.homeAddress,
          identificationNumber: payload.identificationNumber,
          occupation: payload.occupation,
          isPep: payload.isPep,
          expectedMonthlyUsd: payload.expectedMonthlyUsd,
          expectedActivity: payload.expectedActivity,
          photoHash: payload.photoHash,
        },
        {
          sourceOfIncomeCollected: edd.sourceOfIncomeCollected,
          siteVisitCompleted: edd.siteVisitCompleted,
          familyAndAssociatesScreened: edd.familyAndAssociatesScreened,
        }
      );

      setStatus({ type: "notice", msg: `Transaction submitted: ${tx.hash}` });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: `Registered successfully. Tx confirmed in block ${receipt.blockNumber}.` });

      // Reset
      setForm({
        customerId: "",
        fullName: "",
        homeAddress: "",
        identificationNumber: "",
        occupation: "",
        pep: "NO",
        expectedMonthlyUsd: "",
        expectedActivity: "",
      });
      setPhoto(null);
      setEddAnswers({ sourceOfIncome: "NO", siteVisit: "NO", familyScreening: "NO" });
      setPendingRegisterPayload(null);
      setEddOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmEddAndRegister() {
    if (!pendingRegisterPayload) return;

    const edd = {
      sourceOfIncomeCollected: eddAnswers.sourceOfIncome === "YES",
      siteVisitCompleted: eddAnswers.siteVisit === "YES",
      familyAndAssociatesScreened: eddAnswers.familyScreening === "YES",
    };

    await submitRegister(pendingRegisterPayload, edd);
  }

  return (
    <>
      <Head>
        <title>Retail Customer Onboarding Using Smart Contract and Blockchain</title>
        <meta name="description" content="Smart contract prototype for AML/KYC/CDD " />
      </Head>

      <div className="container">
        <div className="header">
          <div className="brand">
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(124,92,255,0.35)", border: "1px solid rgba(255,255,255,0.10)" }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Retail Customer Onboarding Using Smart Contract and Blockchain</div>
             
            </div>
          </div>

          <div className="row">
            <span className="badge">{wallet ? `Connected: ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Not connected"}</span>
            <button className="button" onClick={connect}>
              Connect MetaMask
            </button>
          </div>
        </div>

        <div className="card">
          <div className="grid">
            <div>
              <label className="label">Customer Photo (stored as a hash on-chain)</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              />
              {photoPreview && (
                <div style={{ marginTop: 10 }}>
                  <img className="preview" src={photoPreview} alt="Preview" />
                </div>
              )}

              <div className="hr" />

              <label className="label">PEP</label>
              <select className="select" value={form.pep} onChange={(e) => setField("pep", e.target.value)}>
                <option value="NO">No</option>
                <option value="YES">Yes</option>
              </select>

          

             
            </div>

            <div>
              <label className="label">Customer ID</label>
              <input className="input" value={form.customerId} onChange={(e) => setField("customerId", e.target.value)} placeholder="e.g., CUST-0001" />

              <div style={{ height: 10 }} />

              <label className="label">Full Name</label>
              <input className="input" value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} placeholder="e.g., John Smith" />

              <div style={{ height: 10 }} />

              <label className="label">Address</label>
              <input className="input" value={form.homeAddress} onChange={(e) => setField("homeAddress", e.target.value)} placeholder="Street, City, Country" />

              <div style={{ height: 10 }} />

              <label className="label">Identification Number</label>
              <input className="input" value={form.identificationNumber} onChange={(e) => setField("identificationNumber", e.target.value)} placeholder="Passport/Emirates ID/Other" />

              <div style={{ height: 10 }} />

              <label className="label">Occupation</label>
              <input className="input" value={form.occupation} onChange={(e) => setField("occupation", e.target.value)} placeholder="e.g., Engineer" />

              <div style={{ height: 10 }} />

              <label className="label">Expected Transaction Activity (USD)</label>
              <input
                className="input"
                value={form.expectedMonthlyUsd}
                onChange={(e) => setField("expectedMonthlyUsd", e.target.value)}
                placeholder="e.g., 12000"
                inputMode="numeric"
              />

              <div style={{ height: 10 }} />

              <label className="label">Purpose of Opening Account</label>
              <textarea
                className="textarea"
                value={form.expectedActivity}
                onChange={(e) => setField("expectedActivity", e.target.value)}
                placeholder="Example:  savings transfers..."
              />

              <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                <button className="button" onClick={startRegister} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Register Customer on Blockchain"}
                </button>
              </div>

              {status.type === "alert" && <div className="alert">{status.msg}</div>}
              {status.type === "success" && <div className="success">{status.msg}</div>}
              {status.type === "notice" && <div className="notice">{status.msg}</div>}
            </div>
          </div>
        </div>

     

        <EddModal
          open={eddOpen}
          onClose={() => setEddOpen(false)}
          onConfirm={confirmEddAndRegister}
          answers={eddAnswers}
          setAnswers={setEddAnswers}
          isSubmitting={isSubmitting}
        />
      </div>
    </>
  );
}
