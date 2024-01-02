import {
  SentryAppComponent as TSentryAppComponent,
  SentryAppSchemaIssueLink,
} from 'sentry/types';

export function SentryAppComponent(
  params = {}
): TSentryAppComponent<SentryAppSchemaIssueLink> {
  return {
    uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
    type: 'issue-link',
    schema: {
      type: 'issue-link',
      create: {
        uri: '',
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
            choices: [
              ['number_1', 'one'],
              ['number_2', 'two'],
            ],
          },
        ],
      },
      link: {
        uri: '',
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
      avatars: [],
    },
    ...params,
  };
}
export function SentryAppComponentAsync(
  params = {}
): TSentryAppComponent<SentryAppSchemaIssueLink> {
  return {
    uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
    type: 'issue-link',
    schema: {
      type: 'issue-link',
      create: {
        uri: '',
        required_fields: [
          {
            type: 'select',
            name: 'numbers',
            label: 'Numbers',
            uri: '/sentry/numbers',
            url: '/sentry/numbers',
            async: true,
          },
        ],
      },
      link: {
        uri: '',
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
      avatars: [],
    },
    ...params,
  };
}

export function SentryAppComponentDependent(
  params = {}
): TSentryAppComponent<SentryAppSchemaIssueLink> {
  return {
    type: 'issue-link',
    uuid: 'ed517da4-a324-44c0-aeea-1894cd9923fb',
    schema: {
      type: 'issue-link',
      link: {
        required_fields: [
          {
            choices: [
              ['A', 'project A'],
              ['B', 'project B'],
              ['C', 'project C'],
            ],
            type: 'select',
            uri: '/integrations/sentry/projects',
            name: 'project_id',
            label: 'Project',
          },
          {
            depends_on: ['project_id'],
            name: 'board_id',
            choices: [],
            type: 'select',
            uri: '/integrations/sentry/boards',
            label: 'Board',
          },
        ],
        uri: '/integrations/sentry/issues/link',
      },
      create: {
        required_fields: [
          {
            default: 'issue.title',
            type: 'text',
            name: 'title',
            label: 'Title',
          },
          {
            default: 'issue.description',
            type: 'textarea',
            name: 'description',
            label: 'Description',
          },
          {
            choices: [
              ['A', 'project A'],
              ['B', 'project B'],
            ],
            type: 'select',
            uri: '/integrations/sentry/projects',
            name: 'project_id',
            label: 'Project',
          },
          {
            depends_on: ['project_id'],
            name: 'board_id',
            choices: [],
            type: 'select',
            uri: '/integrations/sentry/boards',
            label: 'Board',
          },
        ],
        uri: '/integrations/sentry/issues/create',
      },
    },
    sentryApp: {
      uuid: 'b468fed3-afba-4917-80d6-bdac99c1ec05',
      slug: 'foo',
      name: 'Foo',
      avatars: [],
    },
    ...params,
  };
}
