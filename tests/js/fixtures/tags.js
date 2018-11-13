export function Tags(params = {}) {
  return [
    {key: 'browser', name: 'Browser', canDelete: true, totalValues: 30},
    {key: 'device', name: 'Device', canDelete: true, totalValues: 5},
    {key: 'url', name: 'URL', canDelete: true, totalValues: 7},
    {key: 'environment', name: 'Environment', canDelete: false, totalValues: 100},
    ...params,
  ];
}
