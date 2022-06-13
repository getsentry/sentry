export function Tags(params = []) {
  return [
    {
      topValues: [
        {
          count: 10,
          name: 'Chrome',
          value: 'Chrome',
          lastSeen: '2018-11-16T22:52:24Z',
          key: 'browser',
          firstSeen: '2018-05-06T03:48:28.855Z',
        },
        {
          count: 5,
          name: 'Firefox',
          value: 'Firefox',
          lastSeen: '2018-12-20T23:32:25Z',
          key: 'browser',
          firstSeen: '2018-12-20T23:32:43.811Z',
        },
      ],
      uniqueValues: 2,
      name: 'Browser',
      key: 'browser',
      totalValues: 18,
      canDelete: true,
    },
    {
      topValues: [
        {
          count: 17,
          name: 'Other',
          value: 'Other',
          lastSeen: '2018-11-16T22:52:24Z',
          key: 'device',
          firstSeen: '2018-05-06T03:48:28.836Z',
        },
      ],
      uniqueValues: 1,
      name: 'Device',
      key: 'device',
      totalValues: 17,
      canDelete: true,
    },
    {
      topValues: [
        {
          count: 18,
          name: 'http://example.com/foo',
          value: 'http://example.com/foo',
          lastSeen: '2018-12-20T23:32:25Z',
          key: 'url',
          firstSeen: '2018-05-06T03:48:28.825Z',
        },
      ],
      uniqueValues: 1,
      name: 'URL',
      key: 'url',
      totalValues: 18,
      canDelete: true,
    },
    {
      topValues: [{name: 'prod', value: 'prod', key: 'environment', count: 100}],
      key: 'environment',
      name: 'Environment',
      canDelete: false,
      totalValues: 100,
    },
    {
      topValues: [
        {
          count: 3,
          name: 'david',
          value: 'username:david',
          lastSeen: '2018-12-20T23:32:25Z',
          key: 'user',
          query: 'user.username:david',
          firstSeen: '2018-10-03T03:40:05.627Z',
        },
        {
          count: 2,
          name: 'meredith',
          value: 'username:meredith',
          lastSeen: '2018-10-16T20:12:20Z',
          key: 'user',
          query: 'user.username:meredith',
          firstSeen: '2018-10-15T23:24:05.570Z',
        },
      ],
      uniqueValues: 12,
      name: 'User',
      key: 'user',
      totalValues: 18,
    },
    ...params,
  ];
}
