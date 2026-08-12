import {Flex} from '@sentry/scraps/layout';

import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';
import {IssuePreviewSeerActions} from 'sentry/views/issueDetails/issuePreview/issuePreviewSeerActions';

interface RedesignHeaderActionsProps {
  disabled: boolean;
  event: Event | null;
  group: Group;
  project: Project;
}

/**
 * The header action cluster. Mirrors the inbox preview by surfacing the primary
 * Seer CTA (when available) to the left of the standard issue actions. When that
 * CTA is present the Resolve button is de-emphasized to secondary so the Seer
 * action reads as the primary next step (issue #11).
 */
export function RedesignHeaderActions({
  group,
  project,
  event,
  disabled,
}: RedesignHeaderActionsProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {hasAutofix} = useAiConfig(group, project);
  const autofix = useExplorerAutofix(group, {enabled: hasAutofix});

  return (
    <Flex align="center" gap="sm" wrap="wrap" justify="start">
      {hasAutofix && (
        <IssuePreviewSeerActions
          autofix={autofix}
          group={group}
          disabled={disabled}
          onContinueInSeer={() =>
            navigate({
              ...location,
              query: {...location.query, tab: 'investigation'},
            })
          }
        />
      )}
      <GroupActions
        group={group}
        project={project}
        disabled={disabled}
        event={event}
        resolvePriority={hasAutofix ? 'default' : 'primary'}
      />
    </Flex>
  );
}
