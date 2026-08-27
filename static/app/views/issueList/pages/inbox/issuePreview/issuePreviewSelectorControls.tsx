import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
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
  const organization = useOrganization();
  const hasRedesignedControls = organization.features.includes(
    'issue-priority-assignee-ui'
  );

  return (
    <Flex align="center" wrap="wrap" gap={hasRedesignedControls ? 'md' : 'lg'}>
      <GroupPriority
        group={group}
        trigger={
          hasRedesignedControls
            ? (props, _isOpen, context) => (
                <Button
                  {...props}
                  aria-label={context.ariaLabel}
                  disabled={context.disabled}
                  icon={<IconCellSignal bars={context.bars} />}
                  size="zero"
                  tooltipProps={{title: context.tooltip}}
                  variant="secondary"
                />
              )
            : undefined
        }
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
