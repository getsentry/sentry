export function AuditLogs(params = []) {
  return [
    {
      note: 'edited project ludic-science',
      targetObject: 2,
      targetUser: null,
      data: {
        status: 0,
        slug: 'ludic-science',
        public: false,
        name: 'Ludic Science',
        id: 2,
      },
      dateCreated: '2018-02-21T03:04:23.157Z',
      ipAddress: '127.0.0.1',
      id: '465',
      actor: TestStubs.User({isSuperuser: true}),
      event: 'project.edit',
    },
    {
      note: 'edited the organization setting(s): accountRateLimit from 1000 to 0',
      targetObject: 2,
      targetUser: null,
      data: {accountRateLimit: 'from 1000 to 0'},
      dateCreated: '2018-02-16T23:45:59.813Z',
      ipAddress: '127.0.0.1',
      id: '408',
      actor: TestStubs.User({isSuperuser: false}),
      event: 'org.edit',
    },
    ...params,
  ];
}
