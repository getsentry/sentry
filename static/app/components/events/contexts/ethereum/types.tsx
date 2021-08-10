export enum EthereumKnownDataType {
  BLOCK = 'block',
  CUMULATIVE_GAS_USED = 'cumulativeGasUsed',
  EFFECTIVE_GAS_PRICE = 'effectiveGasPrice',
  FROM = 'from',
  GAS = 'gas',
  GAS_PRICE = 'gasPrice',
  GAS_USED = 'gasUsed',
  STATUS = 'status',
  TO = 'to',
  TRANSACTION_HASH = 'transactionHash',
  TRANSACTION_FEE = 'transactionFee',
  VALUE = 'value',
}

export type EthereumData = {
  block: string;
  cumulativeGasUsed: number;
  effectiveGasPrice: number;
  from: string;
  gas: number;
  gasPrice: number;
  gasUsed: number;
  status: 0 | 1;
  to: string;
  transactionHash: string;
  value: number;
  transactionFee: number;
};
