export function EventAttachment(params = {}) {
  return {
    id: '1',
    name: 'screenshot.png',
    headers: {
      'Content-Type': 'image/png',
    },
    mimetype: 'image/png',
    size: 84235,
    sha1: '986043ce8056f3cde048720d30a3959a6692fbef',
    dateCreated: '2022-09-12T09:27:30.512445Z',
    type: 'event.attachment',
    event_id: '12345678901234567890123456789012',
    ...params,
  };
}
