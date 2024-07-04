export const FIELDS = [
  'project',
  'transaction.id',
  'id',
  'timestamp',
  'sdk.name',
  'span.op',
  'span.description',
  'span.duration',
  'span.status',
  'span.self_time',
  'precise.start_ts',
  'precise.finish_ts',
  'is_transaction',
] as const;

export type Field = (typeof FIELDS)[number];

export type Sort = Field | `-${Field}`;

export const SORTS: Sort[] = ['-is_transaction', '-span.self_time'];
