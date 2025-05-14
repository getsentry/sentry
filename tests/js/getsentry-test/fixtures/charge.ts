type Charge = {
  amount: number;
  amountRefunded: number;
  cardLast4: string;
  dateCreated: string;
  failureCode: string | null;
  id: string;
  invoiceID: string;
  isPaid: boolean;
  isRefunded: boolean;
  stripeID: string;
};

export function ChargeFixture(params: Partial<Charge>): Charge {
  return {
    amount: 29,
    amountRefunded: 0,
    cardLast4: '1226',
    dateCreated: '2018-04-12T01:55:50Z',
    failureCode: null,
    id: '987654',
    invoiceID: '9a8b7c6d5e4f',
    isPaid: true,
    isRefunded: false,
    stripeID: 'ch_XxX12xxxXXxxx26',
    ...params,
  };
}
