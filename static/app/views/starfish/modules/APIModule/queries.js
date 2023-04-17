export const ENDPOINT_LIST_QUERY = `SELECT description, count() AS count
 FROM spans_experimental_starfish
 WHERE module = 'http'
 GROuP BY description
 ORDER BY count DESC
 LIMIT 10
`;
