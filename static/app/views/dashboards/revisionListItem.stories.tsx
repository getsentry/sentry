import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import * as Storybook from 'sentry/stories';

import {RevisionDiffBody, RevisionListItem} from './revisionListItem';
import type {DashboardDetails} from './types';
import {DisplayType} from './types';

const ALICE = {id: '1', name: 'Alice', email: 'alice@example.com'};
const BOB = {id: '2', name: 'Bob', email: 'bob@example.com'};
const DATE = '2024-06-01T10:00:00Z';
const DATE_OLDER = '2024-05-28T09:00:00Z';
const DASHBOARD_ID = 'demo';

function base(overrides: Partial<DashboardDetails> = {}): DashboardDetails {
  return {
    id: '1',
    title: 'My Dashboard',
    dateCreated: DATE_OLDER,
    widgets: [],
    filters: {},
    projects: [],
    ...overrides,
  };
}

export default Storybook.story('RevisionListItem', story => {
  story('Overview', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="RevisionListItem" /> shows a single entry in the
          Dashboard Revisions modal. Each item displays the revision metadata (source
          label, timestamp, author) and an inline diff of what changed between this
          revision and the one before it.
        </p>
        <p>
          The item is selectable via a radio button. When selected, an accent left-border
          appears and the Revert button in the modal footer becomes enabled.
        </p>
      </Fragment>
    );
  });

  story('Loading', () => {
    return (
      <ItemContainer>
        <RevisionDiffBody
          isLoading
          isError={false}
          snapshot={undefined}
          baseRevisionId={null}
          baseSnapshot={undefined}
        />
      </ItemContainer>
    );
  });

  story('Error', () => {
    return (
      <ItemContainer>
        <RevisionDiffBody
          isLoading={false}
          isError
          snapshot={undefined}
          baseRevisionId={null}
          baseSnapshot={undefined}
        />
      </ItemContainer>
    );
  });

  story('Current Version', () => {
    const [selected, setSelected] = useState(true);
    const snapshot = base({
      title: 'My Dashboard',
      widgets: [
        {
          id: '1',
          title: 'Error Rate',
          displayType: DisplayType.LINE,
          queries: [],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    const prevSnapshot = base({
      title: 'My Dashboard',
      widgets: [
        {
          id: '1',
          title: 'Error Rate',
          displayType: DisplayType.LINE,
          queries: [],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    return (
      <ItemContainer>
        <RevisionListItem
          isCurrentVersion
          isSelected={selected}
          onSelect={() => setSelected(s => !s)}
          revisionSource="edit"
          createdBy={ALICE}
          dateCreated={null}
          dashboardId={DASHBOARD_ID}
          baseRevisionId="prev"
          snapshotOverride={snapshot}
          baseSnapshotOverride={prevSnapshot}
        />
      </ItemContainer>
    );
  });

  story('Widget changes — added, removed, modified', () => {
    const [selected, setSelected] = useState(false);
    const snapshot = base({
      widgets: [
        {
          id: '1',
          title: 'Error Rate',
          displayType: DisplayType.LINE,
          queries: [
            {
              name: '',
              fields: [],
              columns: [],
              aggregates: ['count()'],
              conditions: 'level:error',
              orderby: '',
            },
          ],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
        {
          id: '3',
          title: 'New Widget',
          displayType: DisplayType.BAR,
          queries: [],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    const prevSnapshot = base({
      widgets: [
        {
          id: '1',
          title: 'Error Rate',
          displayType: DisplayType.LINE,
          queries: [
            {
              name: '',
              fields: [],
              columns: [],
              aggregates: ['count()'],
              conditions: 'level:error',
              orderby: '',
            },
          ],
          interval: '30m',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
        {
          id: '2',
          title: 'Removed Widget',
          displayType: DisplayType.TABLE,
          queries: [],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    return (
      <ItemContainer>
        <RevisionListItem
          isSelected={selected}
          onSelect={() => setSelected(s => !s)}
          revisionSource="edit"
          createdBy={BOB}
          dateCreated={DATE}
          dashboardId={DASHBOARD_ID}
          baseRevisionId="prev"
          revisionId="rev1"
          snapshotOverride={snapshot}
          baseSnapshotOverride={prevSnapshot}
        />
      </ItemContainer>
    );
  });

  story('Dashboard filter changes', () => {
    const [selected, setSelected] = useState(false);
    const snapshot = base({
      title: 'Renamed Dashboard',
      period: '14d',
      environment: ['production'],
      filters: {release: ['v2.0.0']},
      projects: [-1],
    });
    const prevSnapshot = base({
      title: 'My Dashboard',
      period: '7d',
      environment: [],
      filters: {},
      projects: [],
    });
    return (
      <ItemContainer>
        <RevisionListItem
          isSelected={selected}
          onSelect={() => setSelected(s => !s)}
          revisionSource="edit"
          createdBy={ALICE}
          dateCreated={DATE}
          dashboardId={DASHBOARD_ID}
          baseRevisionId="prev"
          revisionId="rev2"
          snapshotOverride={snapshot}
          baseSnapshotOverride={prevSnapshot}
        />
      </ItemContainer>
    );
  });

  story('Oldest revision — no previous state', () => {
    const [selected, setSelected] = useState(false);
    const snapshot = base({
      widgets: [
        {
          id: '1',
          title: 'Error Rate',
          displayType: DisplayType.LINE,
          queries: [],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    return (
      <ItemContainer>
        <RevisionListItem
          isSelected={selected}
          onSelect={() => setSelected(s => !s)}
          revisionSource="edit"
          createdBy={BOB}
          dateCreated={DATE_OLDER}
          dashboardId={DASHBOARD_ID}
          baseRevisionId={null}
          revisionId="rev-oldest"
          snapshotOverride={snapshot}
        />
      </ItemContainer>
    );
  });

  story('AI-assisted revision (Edit with Seer)', () => {
    const [selected, setSelected] = useState(false);
    const snapshot = base({
      widgets: [
        {
          id: '10',
          title: 'P95 Latency by Endpoint',
          displayType: DisplayType.LINE,
          queries: [
            {
              name: '',
              fields: [],
              columns: [],
              aggregates: ['p95(duration)'],
              conditions: '',
              orderby: '',
            },
          ],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    const prevSnapshot = base();
    return (
      <ItemContainer>
        <RevisionListItem
          isSelected={selected}
          onSelect={() => setSelected(s => !s)}
          revisionSource="edit-with-agent"
          createdBy={ALICE}
          dateCreated={DATE}
          dashboardId={DASHBOARD_ID}
          baseRevisionId="prev"
          revisionId="rev3"
          snapshotOverride={snapshot}
          baseSnapshotOverride={prevSnapshot}
        />
      </ItemContainer>
    );
  });

  story('Revert Dashboard revision', () => {
    const [selected, setSelected] = useState(false);
    const snapshot = base();
    const prevSnapshot = base({
      widgets: [
        {
          id: '5',
          title: 'Transactions',
          displayType: DisplayType.BAR,
          queries: [],
          interval: '1h',
          layout: null,
          thresholds: null,
          description: '',
          tempId: undefined,
          widgetType: undefined,
          limit: undefined,
        },
      ],
    });
    return (
      <ItemContainer>
        <RevisionListItem
          isSelected={selected}
          onSelect={() => setSelected(s => !s)}
          revisionSource="pre-restore"
          createdBy={BOB}
          dateCreated={DATE}
          dashboardId={DASHBOARD_ID}
          baseRevisionId="prev"
          revisionId="rev4"
          snapshotOverride={snapshot}
          baseSnapshotOverride={prevSnapshot}
        />
      </ItemContainer>
    );
  });
});

const ItemContainer = styled('div')`
  max-width: 680px;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
`;
