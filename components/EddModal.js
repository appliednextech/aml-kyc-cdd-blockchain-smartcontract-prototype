import React from "react";

export default function EddModal({
  open,
  onClose,
  onConfirm,
  answers,
  setAnswers,
  isSubmitting,
}) {
  if (!open) return null;

  const set = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const allYes =
    answers.sourceOfIncome === "YES" &&
    answers.siteVisit === "YES" &&
    answers.familyScreening === "YES";

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalHeader">
          <div>
            <h3 className="modalTitle">Enhanced Due Diligence (EDD) Checklist</h3>
            <p className="muted">
              This customer is classified as <b>High Risk</b> (PEP and/or expected activity &gt; 10,000 USD).
              To proceed, all checklist items must be marked <b>Yes</b>.
            </p>
          </div>
          <button className="button secondary" onClick={onClose} disabled={isSubmitting}>
            Close
          </button>
        </div>

        <div className="checkRow">
          <div>
            <div><b>1)</b> Has supporting evidence for <b>source of income</b> been collected from the customer?</div>
            <div className="small">Example: salary certificate, payslips, bank statement, business invoices.</div>
          </div>
          <div className="radioGroup">
            <label>
              <input
                type="radio"
                name="sourceOfIncome"
                checked={answers.sourceOfIncome === "YES"}
                onChange={() => set("sourceOfIncome", "YES")}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="sourceOfIncome"
                checked={answers.sourceOfIncome === "NO"}
                onChange={() => set("sourceOfIncome", "NO")}
              />
              No
            </label>
          </div>
        </div>

        <div className="checkRow">
          <div>
            <div><b>2)</b> Has evidence of a <b>site visit</b> to the customer&apos;s premises been completed?</div>
            <div className="small">If applicable for the customer type and risk profile.</div>
          </div>
          <div className="radioGroup">
            <label>
              <input
                type="radio"
                name="siteVisit"
                checked={answers.siteVisit === "YES"}
                onChange={() => set("siteVisit", "YES")}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="siteVisit"
                checked={answers.siteVisit === "NO"}
                onChange={() => set("siteVisit", "NO")}
              />
              No
            </label>
          </div>
        </div>

        <div className="checkRow">
          <div>
            <div><b>3)</b> Has name screening of the customer&apos;s <b>family members and close associates</b> been completed?</div>
            <div className="small">Example: screening against sanctions/PEP/adverse media lists.</div>
          </div>
          <div className="radioGroup">
            <label>
              <input
                type="radio"
                name="familyScreening"
                checked={answers.familyScreening === "YES"}
                onChange={() => set("familyScreening", "YES")}
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                name="familyScreening"
                checked={answers.familyScreening === "NO"}
                onChange={() => set("familyScreening", "NO")}
              />
              No
            </label>
          </div>
        </div>

        {!allYes && (
          <div className="alert">
            High-risk customers can only be registered if <b>all</b> EDD items are <b>Yes</b>.
          </div>
        )}

        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button
            className="button"
            onClick={() => onConfirm()}
            disabled={isSubmitting || !allYes}
            title={!allYes ? "All EDD items must be Yes" : "Proceed to register"}
          >
            {isSubmitting ? "Submitting..." : "Confirm & Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
