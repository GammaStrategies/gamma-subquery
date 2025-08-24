// Auto-generated , please modify to ensure correctness

import {
  EthereumProject,
  EthereumDatasourceKind,
  EthereumHandlerKind,
} from "@subql/types-ethereum";

// Can expand the Datasource processor types via the generic param
const project: EthereumProject = {
  specVersion: "1.0.0",
  version: "1.0.0",
  name: "gamma-fees-31",
  description: "",
  runner: {
    node: {
      name: "@subql/node-ethereum",
      version: ">=3.0.0",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  schema: {
    file: "./schema.graphql",
  },
  network: {
    chainId: "6900",
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     * If you use a rate limited endpoint, adjust the --batch-size and --workers parameters
     * These settings can be found in your docker-compose.yaml, they will slow indexing but prevent your project being rate limited
     */
    endpoint: ["https://evm-rpc.archive.nibiru.fi"],
  },
  dataSources: [
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 27282317,
      options: {
        abi: "HypeRegistry",
        address: "0x2A078554094f5e342B69E5b6D3665507283EfBa1",
      },
      assets: new Map([
        ["HypeRegistry", { file: "./abis/HypeRegistry.json" }],
        ["PairManager", { file: "./abis/Hypervisor.json" }],
        ["Totals", { file: "./abis/Totals.json" }],
        ["ERC20", { file: "./abis/ERC20.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          // TODO: Block handlers not fully supported in SubQuery yet
          {
            kind: EthereumHandlerKind.Block,
            handler: "handleOnce",
            filter: {
              modulo: 27282317,
            },
          },
          {
            kind: EthereumHandlerKind.Block,
            handler: "handle1h",
            filter: {
              modulo: 50,
            }
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleHypeAdded",
            filter: { topics: ["HypeAdded(address,uint256)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleHypeRemoved",
            filter: { topics: ["HypeRemoved(address,uint256)"] },
          },
        ],
      },
    },
  ],
  templates: [
    {
      name: "PairManager",
      kind: EthereumDatasourceKind.Runtime,
      options: {
        abi: "PairManager",
      },

      assets: new Map([
        ["PairManager", { file: "./abis/Hypervisor.json" }],
        ["Totals", { file: "./abis/Totals.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleDeposit",
            filter: {
              topics: ["Deposit(address,address,uint256,uint256,uint256)"],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleWithdraw",
            filter: {
              topics: ["Withdraw(address,address,uint256,uint256,uint256)"],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleTransfer",
            filter: { topics: ["Transfer(address,address,uint256)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleZeroBurn",
            filter: { topics: ["ZeroBurn(uint8,uint256,uint256)"] },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleSetFee",
            filter: { topics: ["SetFee(uint8)"] },
          },
        ],
      },
    },
  ],
  repository: "",
};

// Must set default to the project instance
export default project;
