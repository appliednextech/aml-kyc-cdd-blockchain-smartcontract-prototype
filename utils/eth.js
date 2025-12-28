import { BrowserProvider, Contract } from "ethers";
import abi from "./abi.json";

export const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export function getContractAddress() {
  const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!addr) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set. Deploy the contract and set it in .env.local.");
  return addr;
}

export async function getProvider() {
  if (typeof window === "undefined") throw new Error("No window");
  if (!window.ethereum) throw new Error("MetaMask not detected. Please install MetaMask.");
  const provider = new BrowserProvider(window.ethereum);
  return provider;
}

export async function ensureSepolia() {
  if (!window.ethereum) throw new Error("MetaMask not detected.");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId === SEPOLIA_CHAIN_ID) return;

  // Ask MetaMask to switch
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }],
    });
  } catch (err) {
    // If Sepolia is not added, try to add it
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia",
            nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function getSigner() {
  const provider = await getProvider();
  await provider.send("eth_requestAccounts", []);
  return await provider.getSigner();
}

export async function getReadContract() {
  const provider = await getProvider();
  return new Contract(getContractAddress(), abi, provider);
}

export async function getWriteContract() {
  const signer = await getSigner();
  return new Contract(getContractAddress(), abi, signer);
}
