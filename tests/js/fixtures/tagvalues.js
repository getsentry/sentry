export function TagValues(params = {}) {
  return [
    {key: 'browser', name: 'Browser', 'topValues': [
        {value: 'Chrome', count: 10},
        {value: 'Firefox', count: 5},
    ]},
    {key: 'device', name: 'Device', 'topValues': [
        {value: 'iPhone', count: 1},
        {value: 'Pixel', count: 2},
    ]},
    {key: 'url', name: 'URL', 'topValues': [
        {value: 'foo.com', count: 2},
        {value: 'bar.com', count: 5},
    ]},
    {key: 'environment', name: 'Environment', 'topValues': [
        {value: 'prod', count: 100},
    ]},
    ...params,
  ];
}
