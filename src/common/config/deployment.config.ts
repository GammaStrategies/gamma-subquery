/**
 * Deployment Configuration
 *
 * This file replaces the datasource context from The Graph Protocol
 * Edit these values based on your deployment network and requirements
 */

export interface DeploymentConfig {
  name: string;
  network: string;
  dex: string;
  underlyingProtocol: string;
  poolVersion: string;
  poolManager: string;
  feeCalcMethod: "oneOverFees" | "feeOverOneHundred";
  blocks1h: bigint;
  getTotalsContract: string;
  getTotalsContractStartBlock: bigint;
  codeVersion: string;
  schemaVersion: string;

  // Native token configuration
  nativeToken: {
    name: string;
    symbol: string;
    decimals: number;
  };

  // Wrapped native token address
  wrappedNativeToken: string;
}

// Network configurations
const deploymentConfigs: Record<string, DeploymentConfig> = {
  nibiru: {
    name: "uniswapv3.1",
    network: "nibiru",
    dex: "uniswap",
    underlyingProtocol: "UniswapV3",
    poolVersion: "uniswapV3",
    poolManager: "0x0000000000000000000000000000000000000000",
    feeCalcMethod: "oneOverFees",
    blocks1h: 1800n, // ~300 blocks per hour on Ethereum mainnet
    getTotalsContract: "0x0bc5004589cb9a3039c5deb5b05a947fe1847a0d",
    getTotalsContractStartBlock: 27282317n,
    codeVersion: "1.0.0",
    schemaVersion: "1.0.0",
    nativeToken: {
      name: "Nibiru",
      symbol: "NIBI",
      decimals: 18,
    },
    wrappedNativeToken: "0x0cacf669f8446beca826913a3c6b96acd4b02a97", // WETH
  },
};

/**
 * Get deployment configuration for a specific network
 * @returns DeploymentConfig for the nibiru
 */
export function getDeploymentConfig(): DeploymentConfig {
  // Default to mainnet if no network specified
  const selectedNetwork = "nibiru";

  const config = deploymentConfigs[selectedNetwork];
  if (!config) {
    throw new Error(
      `No deployment configuration found for network: ${selectedNetwork}`
    );
  }

  return config;
}
