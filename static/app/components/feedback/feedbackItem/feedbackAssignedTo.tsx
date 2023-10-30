import styled from '@emotion/styled';

import {AssigneeSelectorDropdown} from 'sentry/components/assigneeSelectorDropdown';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import AssignedTo, {getAssignedToDisplayName} from 'sentry/components/group/assignedTo';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconUser} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackEvent: FeedbackEvent | undefined;
  feedbackIssue: FeedbackIssue;
}

export default function FeedbackAssignedTo({feedbackIssue, feedbackEvent}: Props) {
  const organization = useOrganization();

  const dropdown = null;
  <AssigneeSelectorDropdown
    organization={organization}
    disabled={false}
    id={feedbackIssue.id}
    assignedTo={feedbackIssue.assignedTo}
    onAssign={() => {}}
  >
    {({loading, isOpen, getActorProps}) => (
      <Button data-test-id="assignee-selector" {...getActorProps({})}>
        <ActorWrapper>
          {loading ? (
            <StyledLoadingIndicator mini size={24} />
          ) : feedbackIssue.assignedTo ? (
            <ActorAvatar
              data-test-id="assigned-avatar"
              actor={feedbackIssue.assignedTo}
              hasTooltip={false}
              size={24}
            />
          ) : (
            <IconWrapper>
              <IconUser size="xs" />
            </IconWrapper>
          )}
          <ActorName>{getAssignedToDisplayName(feedbackIssue, true)}</ActorName>
        </ActorWrapper>

        <IconChevron
          data-test-id="assigned-to-chevron-icon"
          direction={isOpen ? 'up' : 'down'}
          size="xs"
        />
      </Button>
    )}
  </AssigneeSelectorDropdown>;

  return (
    <AssignedTo
      group={feedbackIssue}
      event={feedbackEvent}
      project={feedbackIssue.project}
      dropdown={dropdown}
    />
  );
}

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  max-width: 85%;
  line-height: 1;
`;

const IconWrapper = styled('div')`
  display: flex;
  padding: ${space(0.25)};
`;

const ActorName = styled('div')`
  line-height: 1.2;
  ${p => p.theme.overflowEllipsis}
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  width: 24px;
  height: 24px;
  margin: 0 !important;
`;
