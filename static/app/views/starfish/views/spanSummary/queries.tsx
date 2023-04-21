export const getSpanSamplesQuery = (spanDescription, transactionName) => {
  return `
    SELECT transaction_id, span_id, exclusive_time
    FROM spans_experimental_starfish
    WHERE description = '${spanDescription}'
    AND transaction = '${transactionName}'
    ORDER BY exclusive_time desc
    LIMIT 10
 `;
};
