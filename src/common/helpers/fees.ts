import { ZERO_BI } from "../config/constants";
import { getOrCreateDeploymentInfo } from "./entities/deployment-info";

export async function calcNetFees(grossFees: bigint, fee: number): Promise<bigint> {
  // Get deployment info - SubQuery will handle caching at the database level
  // since DeploymentInfo is a singleton entity with id "0"
  const deploymentInfo = await getOrCreateDeploymentInfo();
  const feeCalcMethod = deploymentInfo.feeCalcMethod;
  
  let feeTake = ZERO_BI;
  const feeBi = BigInt(fee);

  if (feeCalcMethod === "oneOverFees" && fee > 0) {
    // Gamma Finance method: protocol takes 1/fee of the gross fees
    // e.g., if fee = 10, protocol takes 1/10 = 10% of fees
    feeTake = grossFees / feeBi;
  } else if (feeCalcMethod === "feeOverOneHundred" && fee > 0) {
    // Alternative method: fee represents percentage taken by protocol
    // e.g., if fee = 10, protocol takes 10% of fees
    // Returns: grossFees * (1 - fee/100) = grossFees - (grossFees * fee / 100)
    feeTake = (grossFees * feeBi) / 100n;
  }

  // Return net fees (what LPs keep after protocol fee)
  return grossFees - feeTake;
}