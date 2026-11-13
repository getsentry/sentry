import {Container} from '@sentry/scraps/layout';

import {DiagnosticJson, PropertyTable} from './diagnosticData';

const diagnosticValue = {
  triggered: false,
  threshold: 0,
  description: '',
  owner: null,
  triggered_action_ids: ['501', '502'],
  conditions: [
    {
      result: false,
      value: 0,
      details:
        'A long diagnostic message explaining why the checkout workflow did not trigger, preserving the complete configuration and evaluation context as it wraps across multiple lines.',
      eventUrl:
        'https://example.com/organizations/checkout/issues/diagnostics/events/73dffbccf8cc4c008f14468e6b36172e/?source=workflow-engine-debugger',
    },
  ],
};

const properties = {
  eventId: '73dffbccf8cc4c008f14468e6b36172e',
  enabled: false,
  count: 0,
  note: '',
  owner: null,
  '': 'An empty property key remains visible.',
  description:
    'A long property value preserving the full diagnostic message while wrapping inside the available panel width without hiding any configuration details.',
  config: diagnosticValue,
};

describe('PropertyTable', () => {
  for (const viewport of [400, 1000]) {
    it.snapshot(
      `complete-properties-${viewport}`,
      () => (
        <Container padding="md" background="primary">
          <PropertyTable caption="Properties" data={properties} />
        </Container>
      ),
      {viewport, tags: {area: 'core'}}
    );
  }
});

describe('DiagnosticJson', () => {
  for (const viewport of [400, 1000]) {
    it.snapshot(
      `complete-wrapping-json-${viewport}`,
      () => (
        <Container padding="md" background="primary">
          <DiagnosticJson value={diagnosticValue} />
        </Container>
      ),
      {viewport, tags: {area: 'core'}}
    );
  }
});
