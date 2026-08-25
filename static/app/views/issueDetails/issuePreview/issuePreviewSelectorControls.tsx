import styled from '@emotion/styled';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {
  AssigneeSelectorTrigger,
  AssigneeSelectorTriggerContext,
} from 'sentry/components/assigneeSelectorDropdown';
import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {t} from 'sentry/locale';
import {PriorityLevel, type Group} from 'sentry/types/group';
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
        trigger={props => {
          const priority = group.priority ?? PriorityLevel.MEDIUM;
          const bars =
            priority === PriorityLevel.HIGH
              ? 3
              : priority === PriorityLevel.MEDIUM
                ? 2
                : 1;
          const disabled = group.issueType === 'metric_issue';

          return (
            <Button
              {...props}
              aria-label={t('Modify issue priority')}
              disabled={disabled}
              icon={<IconCellSignal bars={bars} />}
              size="zero"
              tooltipProps={{
                title: disabled
                  ? t('You cannot manually update the priority of a metric issue.')
                  : t('Update the priority of this issue.'),
              }}
              variant="secondary"
            />
          );
        }}
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
    data-test-id="assignee-selector"
    showChevron={false}
    size="zero"
    variant="transparent"
  >
    <IssuePreviewAssigneeAvatar context={context} />
  </AssigneeTrigger>
);

function IssuePreviewAssigneeAvatar({
  context,
}: {
  context: AssigneeSelectorTriggerContext;
}) {
  if (context.assignedTo || context.suggestedActors.length === 0) {
    return context.avatar;
  }

  const assigneeNames = context.suggestedActors
    .map(actor => (actor.type === 'team' ? `#${actor.name}` : actor.name))
    .join(', ');

  return (
    <Tooltip skipWrapper title={t('Suggested assignees: %s', assigneeNames)}>
      <SuggestedAssignees data-test-id="suggested-avatar-stack">
        {context.suggestedActors
          .slice(0, 3)
          .reverse()
          .map(actor => (
            <ActorAvatar
              actor={actor}
              hasTooltip={false}
              key={`${actor.type}:${actor.id}`}
              size={24}
              suggested
            />
          ))}
      </SuggestedAssignees>
    </Tooltip>
  );
}

const AssigneeTrigger = styled(OverlayTrigger.Button)`
  border: none;
  box-shadow: none;
  height: unset;
  padding: 0;

  &:hover {
    background: transparent;
  }
`;

const SuggestedAssignees = styled('div')`
  display: flex;
  align-items: center;

  > * + * {
    margin-inline-start: -${p => p.theme.space.md};
  }
`;
