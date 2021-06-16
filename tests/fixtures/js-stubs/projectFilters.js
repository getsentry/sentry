export function ProjectFilters(params = []) {
  return [
    {
      active: true,
      id: 'browser-extensions',
      name: 'Filter out errors known to be caused by browser extensions',
      description:
        'Certain browser extensions will inject inline scripts and are known to cause errors.',
    },
    {
      active: false,
      id: 'localhost',
      name: 'Filter out events coming from localhost',
      description:
        'This applies to both IPv4 (``127.0.0.1``) and IPv6 (``::1``) addresses.',
    },
    {
      active: ['ie_pre_9', 'ie9'],
      id: 'legacy-browsers',
      name: 'Filter out known errors from legacy browsers',
      description:
        'Older browsers often give less accurate information, and while they may report valid issues, the context to understand them is incorrect or missing.',
    },
    {
      active: false,
      id: 'web-crawlers',
      name: 'Filter out known web crawlers',
      description:
        'Some crawlers may execute pages in incompatible ways which then cause errors that are unlikely to be seen by a normal user.',
    },
    ...params,
  ];
}
