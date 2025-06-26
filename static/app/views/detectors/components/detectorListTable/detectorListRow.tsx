import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
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
      <SimpleTable.RowCell className="name">
        <DetectorLink detector={detector} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="type">
        <DetectorTypeCell type={detector.type} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="last-issue">
        <IssueCell group={issues.length > 0 ? issues[0] : undefined} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="assignee">
        <DetectorAssigneeCell assignee={detector.owner} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="connected-automations">
        <DetectorListConnectedAutomations automationIds={detector.workflowIds} />
      </SimpleTable.RowCell>
    </DetectorSimpleTableRow>
  );
}

export function DetectorListRowSkeleton() {
  return (
    <DetectorSimpleTableRow>
      <SimpleTable.RowCell className="name">
        <div style={{width: '100%'}}>
          <Placeholder height="20px" width="50%" style={{marginBottom: '4px'}} />
          <Placeholder height="16px" width="20%" />
        </div>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="type">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="last-issue">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="assignee">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell className="connected-automations">
        <Placeholder height="20px" />
      </SimpleTable.RowCell>
    </DetectorSimpleTableRow>
  );
}

const DetectorSimpleTableRow = styled(SimpleTable.Row)`
  min-height: 76px;
`;
