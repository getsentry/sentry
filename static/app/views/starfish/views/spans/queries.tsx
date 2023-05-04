export const getTimeSpentQuery = (groupingColumn: string, conditions: string[] = []) => {
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    ${groupingColumn} AS primary_group,
    sum(exclusive_time) AS exclusive_time
    FROM spans_experimental_starfish
    ${validConditions.length > 0 ? 'WHERE' : ''}
    ${validConditions.join(' AND ')}
    GROUP BY primary_group
  `;
};

export const getSpanListQuery = (conditions: string[] = []) => {
  const validConditions = conditions.filter(Boolean);

  return `SELECT
    DISTINCT group_id, span_operation, description, action
    FROM spans_experimental_starfish
    ${validConditions.length > 0 ? 'WHERE' : ''}
    ${validConditions.join(' AND ')}
 `;
};
