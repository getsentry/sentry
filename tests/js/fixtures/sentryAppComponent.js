export function SentryAppComponent(params = {}) {
  return {
    uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
    type: 'issue-link',
    schema: {
      link: {required_fields: [{type: 'text', name: 'a', label: 'A'}]},
      create: {required_fields: [{type: 'text', name: 'b', label: 'B'}]},
    },
    sentryApp: {
      uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
      slug: 'foo',
      name: 'Foo',
    },
    ...params,
  };
}
