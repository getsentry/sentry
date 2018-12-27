export default function parseApiError(resp) {
  let {detail} = (resp && resp.responseJSON) || {};

  // return immediately if string
  if (typeof detail === 'string') return detail;

  if (detail && detail.message) return detail.message;

  return 'Unknown API Error';
}
