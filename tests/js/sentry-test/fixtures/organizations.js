export function Organizations(params = {}) {
  return [
    {
      id: '1',
      name: 'test 1',
      slug: 'test 1',
      require2FA: false,
      status: {
        id: 'active',
        name: 'active',
      },
      ...params,
    },
    {
      id: '2',
      name: 'test 2',
      slug: 'test 2',
      require2FA: false,
      status: {
        id: 'active',
        name: 'active',
      },
      ...params,
    },
  ];
}
