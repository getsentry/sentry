import {css} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {DetectorListConnectedAutomations} from 'sentry/views/detectors/components/detectorListConnectedAutomations';
import {DetectorAssigneeCell} from 'sentry/views/detectors/components/detectorListTable/detectorAssigneeCell';
import {DetectorTypeCell} from 'sentry/views/detectors/components/detectorListTable/detectorTypeCell';

interface DetectorListRowProps {
  detector: Detector;
}

export function DetectorListRow({
  detector: {workflowIds, owner, id, projectId, name, disabled, type, createdBy},
}: DetectorListRowProps) {
  const issues: Group[] = [];

  return (
    <RowWrapper disabled={disabled} data-test-id="detector-list-row">
      <InteractionStateLayer />
      <CellWrapper>
        <DetectorLink
          detectorId={id}
          name={name}
          createdBy={createdBy}
          projectId={projectId}
          disabled={disabled}
        />
      </CellWrapper>
      <CellWrapper className="type">
        <DetectorTypeCell type={type} />
      </CellWrapper>
      <CellWrapper className="last-issue">
        <StyledIssueCell group={issues.length > 0 ? issues[0] : undefined} />
      </CellWrapper>
      <CellWrapper className="assignee">
        <DetectorAssigneeCell assignee={owner} />
      </CellWrapper>
      <CellWrapper className="connected-automations">
        <DetectorListConnectedAutomations automationIds={workflowIds} />
      </CellWrapper>
    </RowWrapper>
  );
}

export function DetectorListRowSkeleton() {
  return (
    <RowWrapper>
      <CellWrapper>
        <div style={{width: '100%'}}>
          <Placeholder height="20px" width="50%" style={{marginBottom: '4px'}} />
          <Placeholder height="16px" width="20%" />
        </div>
      </CellWrapper>
      <CellWrapper className="type">
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="last-issue">
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="creator">
        <Placeholder height="20px" />
      </CellWrapper>
      <CellWrapper className="connected-automations">
        <Placeholder height="20px" />
      </CellWrapper>
    </RowWrapper>
  );
}

const CellWrapper = styled(Flex)`
  padding: 0 ${space(2)};
  flex: 1;
  overflow: hidden;
`;

const StyledIssueCell = styled(IssueCell)`
  padding: ${space(2)};
  margin: -${space(2)};
`;

const RowWrapper = styled('div')<{disabled?: boolean}>`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  position: relative;
  align-items: center;
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  ${p =>
    p.disabled &&
    css`
      ${CellWrapper}, {
        opacity: 0.8;
      }
    `}
`;
