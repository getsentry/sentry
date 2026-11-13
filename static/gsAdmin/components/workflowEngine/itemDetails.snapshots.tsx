import {Container} from '@sentry/scraps/layout';

import type {WorkflowEngineDebuggerResponse} from 'sentry/utils/workflowEngineDebuggerApiOptions';

import {WorkflowEngineItemDetails} from './itemDetails';

type DebuggerItem = WorkflowEngineDebuggerResponse['item'];

const detector: DebuggerItem = {
  id: '501',
  name: 'Checkout Error Detector',
  type: 'detector',
  organizationId: '1',
  projectId: '3',
  context: {
    id: '501',
    projectId: '3',
    name: 'Checkout Error Detector',
    type: 'error',
    enabled: false,
    status: 0,
    description: '',
    dateAdded: '2026-11-01T10:00:00+00:00',
    dateUpdated: '2026-11-11T14:30:00+00:00',
    createdById: '12',
    ownerUserId: null,
    ownerTeamId: '7',
    workflowConditionGroupId: '601',
    projectCount: 1,
    config: {threshold: 0, enabled: false, grouping: {strategy: 'fingerprint'}},
    projectOptions: {'sentry:fingerprinting_rules': null, 'sentry:resolve_age': 0},
    projectOptionSources: {
      'sentry:fingerprinting_rules': 'unset',
      'sentry:resolve_age': 'project_option',
    },
    conditionGroup: {
      id: '601',
      organizationId: '1',
      logicType: 'all',
      conditions: [
        {id: '701', type: 'gt', comparison: 0, conditionResult: 75},
        {id: '702', type: 'lt', comparison: 5, conditionResult: false},
      ],
      actions: [],
    },
    workflows: [
      {
        id: '801',
        name: 'Notify Checkout Team',
        type: 'default',
        enabled: true,
        status: 0,
      },
    ],
    dataSources: [{id: '901', type: 'snuba_query_subscription', sourceId: 'query-123'}],
    latestGroups: [
      {id: '1001', title: 'Checkout request failed', priority: 75, status: 0},
    ],
    contextTruncated: false,
  },
};

const workflow: DebuggerItem = {
  id: '801',
  name: 'Notify Checkout Team',
  type: 'workflow',
  organizationId: '1',
  projectId: null,
  context: {
    id: '801',
    name: 'Notify Checkout Team',
    type: 'default',
    enabled: true,
    status: 0,
    environmentId: '8',
    environment: 'production',
    dateAdded: '2026-11-01T10:00:00+00:00',
    dateUpdated: '2026-11-11T14:30:00+00:00',
    createdById: '12',
    ownerUserId: null,
    ownerTeamId: '7',
    whenConditionGroupId: '602',
    projectCount: 1,
    config: {frequency: 0, testMode: false},
    triggers: {
      id: '602',
      organizationId: '1',
      logicType: 'any-short',
      conditions: [
        {id: '703', type: 'first_seen_event', comparison: true, conditionResult: true},
        {id: '704', type: 'regression_event', comparison: true, conditionResult: true},
      ],
      actions: [],
    },
    actionFilters: [
      {
        id: '603',
        organizationId: '1',
        logicType: 'all',
        conditions: [
          {
            id: '705',
            type: 'tagged_event',
            comparison: {key: 'environment', match: 'eq', value: 'production'},
            conditionResult: true,
          },
        ],
        actions: [
          {
            id: '1101',
            type: 'slack',
            integrationId: '1201',
            status: 'active',
            config: {targetType: 'specific', targetIdentifier: '#checkout-alerts'},
            data: {tags: 'environment,release', notes: 'Inspect the linked detector.'},
          },
        ],
      },
      {
        id: '604',
        organizationId: '1',
        logicType: 'any',
        conditions: [],
        actions: [],
      },
    ],
    detectors: [
      {
        id: '501',
        name: 'Checkout Error Detector',
        type: 'error',
        enabled: false,
        status: 0,
      },
    ],
    additionalMetadata: {revision: 0, notes: 'A returned property from a newer backend.'},
    contextTruncated: true,
  },
};

const event: DebuggerItem = {
  id: '73dffbccf8cc4c008f14468e6b36172e',
  name: 'Checkout request failed with a long diagnostic message that must remain readable',
  type: 'event',
  organizationId: '1',
  projectId: '3',
  context: {
    eventType: 'error',
    platform: 'python',
    timestamp: '2026-11-11T14:30:00+00:00',
    group: {id: '1001', title: 'Checkout request failed', status: 0, priority: 75},
    detectors: workflow.context.detectors ?? [],
    workflows: [],
    contextTruncated: false,
  },
};

const cases: Array<{item: DebuggerItem; name: string; viewport: number}> = [
  {name: 'detector-inline-relationships-collapsed', item: detector, viewport: 1000},
  {name: 'workflow-inline-relationships-collapsed', item: workflow, viewport: 1000},
  {name: 'workflow-inline-relationships-collapsed-narrow', item: workflow, viewport: 400},
  {
    name: 'older-workflow-response',
    item: {
      id: '801',
      name: 'Notify Checkout Team',
      type: 'workflow',
      organizationId: '1',
      projectId: null,
      context: {
        id: '801',
        name: 'Notify Checkout Team',
        type: 'default',
        enabled: true,
        status: 0,
        config: {},
        environmentId: null,
        environment: null,
        triggers: null,
        actionFilters: [],
        detectors: [],
        projectCount: 1,
        contextTruncated: false,
      },
    },
    viewport: 600,
  },
  {
    name: 'missing-trigger-group',
    item: {...detector, context: {...detector.context, conditionGroup: null}},
    viewport: 600,
  },
  {
    name: 'known-empty-trigger-group',
    item: {
      ...detector,
      context: {
        ...detector.context,
        conditionGroup: {
          id: '601',
          organizationId: '1',
          logicType: 'all',
          conditions: [],
          actions: [],
        },
      },
    },
    viewport: 600,
  },
  {name: 'event-narrow', item: event, viewport: 400},
  {
    name: 'group',
    item: {
      id: '1001',
      name: 'Checkout request failed',
      type: 'group',
      organizationId: '1',
      projectId: '3',
      context: {
        id: '1001',
        projectId: '3',
        title: 'Checkout request failed',
        status: 0,
        priority: 75,
        type: 1,
        platform: 'python',
        firstSeen: '2026-11-01T10:00:00+00:00',
        lastSeen: '2026-11-11T14:30:00+00:00',
        detectors: workflow.context.detectors ?? [],
        workflows: detector.context.workflows ?? [],
        contextTruncated: false,
      },
    },
    viewport: 800,
  },
];

// The SSR snapshot harness supports hover/active, not hydrated disclosure clicks.
// Expanded inline node fields are covered by itemDetails.spec.tsx.
describe('WorkflowEngineItemDetails', () => {
  for (const {item, name, viewport} of cases) {
    it.snapshot(
      name,
      () => (
        <Container padding="md" background="primary">
          <WorkflowEngineItemDetails item={item} />
        </Container>
      ),
      {viewport, tags: {area: 'core', itemType: item.type}}
    );
  }
});
