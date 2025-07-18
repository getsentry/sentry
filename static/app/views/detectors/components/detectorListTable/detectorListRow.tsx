import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import type {Group} from 'sentry/types/group';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorListConnectedAutomations} from 'sentry/views/detectors/components/detectorListConnectedAutomations';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';

interface DetectorListRowProps {
  detector: Detector;
}

export function DetectorListRow({detector}: DetectorListRowProps) {
  const issues: Group[] = [];

  return (
    <DetectorSimpleTableRow
      variant={detector.disabled ? 'faded' : 'default'}
      data-test-id="detector-list-row"
    >
      <SimpleTable.RowCell>
        <DetectorLink detector={detector} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="type">
        <DetectorTypeCell type={detector.type} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="last-issue">
        <IssueCell group={issues.length > 0 ? issues[0] : undefined} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="assignee">
        <DetectorAssigneeCell assignee={detector.owner} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell data-column-name="connected-automations">
        <DetectorListConnectedAutomations automationIds={detector.workflowIds} />
      </SimpleTable.RowCell>
    </DetectorSimpleTableRow>
  );
}

export function DetectorListRowSkeleton() {
  return (
    <DetectorSimpleTableRow>
      <SimpleTable.RowCell>
        <div style={{width: '100%'}}>
          <Placeholder height="20px" width="50%" style={{marginBottom: '4px'}} />
          <Placeholder height="16px" width="20%" />
        </div>
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
    </DetectorSimpleTableRow>
  );
}

const DetectorSimpleTableRow = styled(SimpleTable.Row)`
  min-height: 76px;
`;
