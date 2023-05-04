export const getSpanListQuery = (condition: string = '') => {
  return `SELECT
    DISTINCT group_id, span_operation, description, action
    FROM spans_experimental_starfish
    ${condition}
 `;
};
