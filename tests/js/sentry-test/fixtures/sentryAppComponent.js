export function SentryAppComponent(params = {}) {
  return {
    uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
    type: 'issue-link',
    schema: {
      create: {
        required_fields: [
          {
            type: 'text',
            name: 'title',
            label: 'Title',
            default: 'issue.title',
          },
          {
            type: 'textarea',
            name: 'description',
            label: 'Description',
            default: 'issue.description',
          },
          {
            type: 'select',
            name: 'numbers',
            label: 'Numbers',
            choices: [[1, 'one'], [2, 'two']],
            default: 1,
          },
        ],
      },
      link: {
        required_fields: [
          {
            type: 'text',
            name: 'issue',
            label: 'Issue',
          },
        ],
      },
    },
    sentryApp: {
      uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
      slug: 'foo',
      name: 'Foo',
    },
    ...params,
  };
}
