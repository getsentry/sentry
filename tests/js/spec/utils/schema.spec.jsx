import {getSchemaFields} from 'app/utils/schema';

const SCHEMA = {
  type: 'issue-link',
  link: {
    uri: '/sentry/issues/link',
    required_fields: [
      {
        type: 'select',
        name: 'assignee',
        label: 'Assignee',
        uri: '/sentry/members',
      },
    ],
  },

  create: {
    uri: '/sentry/issues/create',
    required_fields: [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
      },
      {
        type: 'text',
        name: 'summary',
        label: 'Summary',
      },
    ],

    optional_fields: [
      {
        type: 'select',
        name: 'points',
        label: 'Points',
        options: [['1', '1'], ['2', '2'], ['3', '3'], ['5', '5'], ['8', '8']],
      },
      {
        type: 'select',
        name: 'assignee',
        label: 'Assignee',
        uri: '/sentry/members',
      },
    ],
  },
};

const EXPECTED = {
  link: {
    fields: [
      {
        type: 'select',
        name: 'assignee',
        label: 'Assignee',
        required: true,
        uri: '/sentry/members',
      },
    ],
    uri: '/sentry/issues/link',
  },
  create: {
    fields: [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
        required: true,
      },
      {
        type: 'text',
        name: 'summary',
        label: 'Summary',
        required: true,
      },
      {
        type: 'select',
        name: 'points',
        label: 'Points',
        options: [['1', '1'], ['2', '2'], ['3', '3'], ['5', '5'], ['8', '8']],
        choices: [['1', '1'], ['2', '2'], ['3', '3'], ['5', '5'], ['8', '8']],
      },
      {
        type: 'select',
        name: 'assignee',
        label: 'Assignee',
        uri: '/sentry/members',
      },
    ],
    uri: '/sentry/issues/create',
  },
};

describe('getSchemaFields', function() {
  it('formats schema to match json form fields', function() {
    const schema = getSchemaFields(SCHEMA);
    expect(schema).toEqual(EXPECTED);
  });
});
