export const getSpanListQuery = (conditions: string[] = []) => {
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    DISTINCT group_id, span_operation, description, action
    FROM spans_experimental_starfish
    ${validConditions.length > 0 ? 'WHERE' : ''}
    ${validConditions.join(' AND ')}
 `;
};
