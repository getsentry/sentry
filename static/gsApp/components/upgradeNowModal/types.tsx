export type Reservations = {
  reservedAttachments: number;
  reservedErrors: number;
  reservedLogByte: number;
  reservedMonitorSeats: number;
  reservedProfileDuration: number | undefined;
  reservedProfileDurationUI: number | undefined;
  reservedReplays: number;
  reservedTransactions: number;
  reservedUptime: number | undefined;
}; // TODO(data categories): BIL-956
