import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import type {AssigneeSelectorTrigger} from 'sentry/components/assigneeSelectorDropdown';
import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';

interface IssuePreviewSelectorControlsProps {
  group: Group;
  project: Project;
}

export function IssuePreviewSelectorControls({
  group,
  project,
}: IssuePreviewSelectorControlsProps) {
  return (
    <Flex align="center" wrap="wrap" gap="md">
      <GroupPriority
        group={group}
        trigger={(props, _isOpen, context) => (
          <Button
            {...props}
            aria-label={context.ariaLabel}
            disabled={context.disabled}
            icon={<IconCellSignal bars={context.bars} />}
            size="zero"
            tooltipProps={{title: context.tooltip}}
            variant="secondary"
          />
        )}
      />
      <GroupHeaderAssigneeSelector
        group={group}
        project={project}
        event={null}
        showLabel={false}
        trigger={renderAssigneeTrigger}
      />
    </Flex>
  );
}

const renderAssigneeTrigger: AssigneeSelectorTrigger = (props, _isOpen, context) => (
  <AssigneeTrigger
    {...props}
    aria-label={t('Modify issue assignee')}
    showChevron={false}
    size="zero"
    variant="transparent"
  >
    <AssigneeContent>
      {context.loading ? (
        <LoadingIndicator relative size={24} style={{height: 24, margin: 0}} />
      ) : (
        context.renderAvatar()
      )}
    </AssigneeContent>
  </AssigneeTrigger>
);

const AssigneeTrigger = styled(OverlayTrigger.Button)`
  align-items: center;
  border: none;
  box-shadow: none;
  display: inline-flex;
  height: 24px;
  justify-content: center;
  line-height: 0;
  padding: 0;

  &:hover {
    background: transparent;
  }
`;

const AssigneeContent = styled('span')`
  align-items: center;
  display: inline-flex;
  height: 24px;
  /* Optically align the avatar with the embossed priority button surface. */
  transform: translateY(2px);
`;
