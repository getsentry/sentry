import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
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
      />
    </Flex>
  );
}
