export const getSpanSamplesQuery = (groupId, transactionName) => {
  return `
    SELECT description, transaction_id, span_id, exclusive_time
    FROM spans_experimental_starfish
    WHERE group_id = '${groupId}'
    AND transaction = '${transactionName}'
    ORDER BY exclusive_time desc
    LIMIT 10
 `;
};
