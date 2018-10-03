export function Tags(params = {}) {
  return [
    {key: 'browser', name: 'Browser', canDelete: true},
    {key: 'device', name: 'Device', canDelete: true},
    {key: 'url', name: 'URL', canDelete: true},
    {key: 'environment', name: 'Environment', canDelete: false},
    ...params,
  ];
}
