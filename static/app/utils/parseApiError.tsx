export default function parseApiError(resp: JQueryXHR): string {
  const {detail} = (resp && resp.responseJSON) || ({} as object);

  // return immediately if string
  if (typeof detail === 'string') {
    return detail;
  }

  if (detail && detail.message) {
    return detail.message;
  }

  return 'Unknown API Error';
}
