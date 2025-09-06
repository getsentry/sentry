export type Reservations = {
  reservedAttachments: number;
  reservedErrors: number;
  reservedLogBytes: number | undefined;
  reservedMonitorSeats: number;
  reservedProfileDuration: number | undefined;
  reservedProfileDurationUI: number | undefined;
  reservedReplays: number;
  reservedTransactions: number;
  reservedUptime: number | undefined;
}; // TODO(data categories): BIL-956
