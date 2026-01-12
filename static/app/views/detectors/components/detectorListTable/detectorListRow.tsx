import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import {Container, Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorListConnectedAutomations} from 'sentry/views/detectors/components/detectorListConnectedAutomations';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';

interface DetectorListRowProps {
  detector: Detector;
  onSelect: (id: string) => void;
  selected: boolean;
  connectedWorkflowIds?: string[];
  connectedWorkflowsPending?: boolean;
}

export function DetectorListRow({
  connectedWorkflowsPending,
  detector,
  connectedWorkflowIds,
  selected,
  onSelect,
}: DetectorListRowProps) {
  const {additionalColumns = [], renderVisualization} = useMonitorViewContext();

  return (
    <DetectorSimpleTableRow
      variant={detector.enabled ? 'default' : 'faded'}
      data-test-id="detector-list-row"
    >
      <SimpleTable.RowCell>
        <Flex gap="md">
          <Flex align="center" flexShrink={0} width="20px" height="20px">
            <Checkbox
              checked={selected}
              onChange={() => onSelect(detector.id)}
              className="select-row"
            />
          </Flex>

          <DetectorLink detector={detector} />
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="type">
        <DetectorTypeCell type={detector.type} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="last-issue">
        <IssueCell group={detector.latestGroup} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="assignee">
        <DetectorAssigneeCell assignee={detector.owner} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="connected-automations">
        {connectedWorkflowsPending ? (
          <Placeholder height="20px" />
        ) : (
          <DetectorListConnectedAutomations
            automationIds={connectedWorkflowIds ?? detector.workflowIds}
          />
        )}
      </SimpleTable.RowCell>
      {additionalColumns.map(col => (
        <Fragment key={col.id}>{col.renderCell(detector)}</Fragment>
      ))}
      {defined(renderVisualization) && renderVisualization({detector})}
    </DetectorSimpleTableRow>
  );
}

export function DetectorListRowSkeleton() {
  const {additionalColumns = [], renderVisualization} = useMonitorViewContext();

  return (
    <DetectorSimpleTableRow>
      <SimpleTable.RowCell>
        <Flex gap="md" width="100%">
          <Flex align="center" flexShrink={0} width="20px" height="20px" />
          <Container width="100%">
            <Placeholder height="20px" width="50%" style={{marginBottom: '4px'}} />
            <Placeholder height="16px" width="20%" />
          </Container>
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="type">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="last-issue">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="assignee">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="connected-automations">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      {additionalColumns.map(col => (
        <Fragment key={col.id}>
          {col.renderPendingCell?.() ?? (
            <SimpleTable.RowCell data-column-name={col.id}>
              <Placeholder height="20px" />
            </SimpleTable.RowCell>
          )}
        </Fragment>
      ))}
      {defined(renderVisualization) ? renderVisualization({detector: null}) : null}
    </DetectorSimpleTableRow>
  );
}

const DetectorSimpleTableRow = styled(SimpleTable.Row)`
  min-height: 76px;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  @media (hover: hover) {
    &:not(:has(:hover)):not(:has(input:checked)) {
      .select-row {
        ${p => p.theme.visuallyHidden}
      }
    }
  }
`;
