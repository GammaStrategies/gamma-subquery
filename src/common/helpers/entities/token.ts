import { Token } from "../../../types";
import { TokenType } from "../../../types/enums";
import { ERC20__factory } from "../../../types/contracts/factories/ERC20__factory";
import { ZERO_BD, ZERO_BI } from "../../config/constants";

// api is provided by SubQuery runtime
declare const api: any;

export async function getOrCreateToken(tokenAddress: string): Promise<Token> {
  let entity = await Token.get(tokenAddress);
  
  if (!entity) {
    entity = Token.create({
      id: tokenAddress,
      type: TokenType.ERC20,
      name: "",
      symbol: "",
      decimals: 18,
      priceUsd: ZERO_BD,
      lastUpdatedBlock: ZERO_BI,
      lastUpdatedTimestamp: ZERO_BI
    });

    try {
      const tokenContract = ERC20__factory.connect(tokenAddress, api);
      
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name().catch(() => ""),
        tokenContract.symbol().catch(() => ""),
        tokenContract.decimals().catch(() => 18)
      ]);

      entity.name = name;
      entity.symbol = symbol;
      entity.decimals = decimals;
    } catch (error) {
      logger.warn(`Failed to get token details for ${tokenAddress}: ${error}`);
    }

    await entity.save();
  }
  
  return entity;
}