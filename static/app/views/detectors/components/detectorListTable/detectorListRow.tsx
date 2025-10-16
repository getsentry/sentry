import styled from '@emotion/styled';

import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorListConnectedAutomations} from 'sentry/views/detectors/components/detectorListConnectedAutomations';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';

interface DetectorListRowProps {
  detector: Detector;
  onSelect: (id: string) => void;
  selected: boolean;
}

export function DetectorListRow({detector, selected, onSelect}: DetectorListRowProps) {
  return (
    <DetectorSimpleTableRow
      variant={detector.enabled ? 'default' : 'faded'}
      data-test-id="detector-list-row"
    >
      <SimpleTable.RowCell>
        <Flex gap="md">
          <CheckboxWrapper>
            <Checkbox
              checked={selected}
              onChange={() => onSelect(detector.id)}
              className="select-row"
            />
          </CheckboxWrapper>

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

const CheckboxWrapper = styled('div')`
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;
