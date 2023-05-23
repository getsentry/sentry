export function getTransactionSamplesQuery({transaction, method}) {
  return `SELECT event_id, start_ts, duration FROM transactions_local
    WHERE transaction_name = '${transaction}'
    AND http_method = '${method}'
    ORDER BY duration DESC LIMIT 5`;
}
