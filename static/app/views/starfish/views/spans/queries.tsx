export const getSpanListQuery = () => {
  return `SELECT
    DISTINCT group_id, span_operation, description
    FROM spans_experimental_starfish
 `;
};
