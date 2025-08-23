import { DeploymentInfo, Token } from "../../../types";
import { TokenType } from "../../../types/enums";
import { ZERO_ADDRESS, ZERO_BD, ZERO_BI } from "../../config/constants";
import { getDeploymentConfig } from "../../config/deployment.config";
import { getOrCreateToken } from "./token";

export async function getOrCreateDeploymentInfo(): Promise<DeploymentInfo> {
  const id = "0"; // singleton
  let info = await DeploymentInfo.get(id);
  
  if (!info) {
    // Get configuration for current deployment
    const config = getDeploymentConfig();
    
    // Build the name string as per original format
    const nameString = `${config.name}:${config.underlyingProtocol}:${config.network}:${config.schemaVersion}:${config.codeVersion}`;
    
    info = DeploymentInfo.create({
      id,
      name: nameString,
      dex: config.dex,
      network: config.network,
      underlyingProtocol: config.underlyingProtocol,
      poolVersion: config.poolVersion,
      poolManager: config.poolManager,
      activePairCount: 0,
      totalPairCount: 0,
      feeCalcMethod: config.feeCalcMethod,
      blocks1h: config.blocks1h,
      getTotalsContract: config.getTotalsContract,
      getTotalsContractStartBlock: config.getTotalsContractStartBlock,
      codeVersion: config.codeVersion,
      schemaVersion: config.schemaVersion
    });
    await info.save();

    // Create native token at zero address
    const nativeToken = Token.create({
      id: ZERO_ADDRESS,
      type: TokenType.NATIVE,
      name: config.nativeToken.name,
      symbol: config.nativeToken.symbol,
      decimals: config.nativeToken.decimals,
      priceUsd: ZERO_BD,
      lastUpdatedBlock: ZERO_BI,
      lastUpdatedTimestamp: ZERO_BI
    });
    await nativeToken.save();

    // Create wrapped native token
    const wrappedNative = await getOrCreateToken(config.wrappedNativeToken);
    wrappedNative.type = TokenType.WRAPPED_NATIVE;
    wrappedNative.name = `Wrapped ${config.nativeToken.name}`;
    wrappedNative.symbol = `W${config.nativeToken.symbol}`;
    await wrappedNative.save();
  }
  
  return info;
}