import { HypeRegistry__factory } from "../../types/contracts/factories/HypeRegistry__factory";
import { ZERO_BI } from "../../common/config/constants";
import {
  getOrCreatePairManager,
  isValidPairManager,
} from "./entities/pair-manager";

// api is provided by SubQuery runtime
declare const api: any;

export async function initializePairManagers(registryAddress: string): Promise<void> {
  const registryContract = HypeRegistry__factory.connect(registryAddress, api);
  
  const totalPairCount = await registryContract.counter();
  logger.warn(`Initializing ${totalPairCount} pairs`);
  
  for (let i = 0; i < Number(totalPairCount); i++) {
    const hypeInfo = await registryContract.hypeByIndex(BigInt(i));
    const pmAddress = hypeInfo[0];
    const pmIndex = hypeInfo[1];
    
    logger.warn(`${pmAddress} at index ${pmIndex}`);
    
    if (BigInt(pmIndex.toString()) > ZERO_BI) {
      if (!(await isValidPairManager(pmAddress))) {
        continue;
      }
      await getOrCreatePairManager(pmAddress);
    }
  }
}