import {useEffect} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import {DeprecatedAssigneeSelectorDropdown} from 'sentry/components/deprecatedAssigneeSelectorDropdown';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import type {EventOwners} from 'sentry/components/group/assignedTo';
import {getAssignedToDisplayName, getOwnerList} from 'sentry/components/group/assignedTo';
import {IconChevron, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackEvent: FeedbackEvent | undefined;
  feedbackIssue: Group;
  showActorName: boolean;
}

export default function FeedbackAssignedTo({
  feedbackIssue,
  feedbackEvent,
  showActorName,
}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const project = feedbackIssue.project;

  useEffect(() => {
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  const {data: eventOwners} = useApiQuery<EventOwners>(
    [
      `/projects/${organization.slug}/${project.slug}/events/${feedbackEvent?.id}/owners/`,
    ],
    {
      staleTime: 0,
      enabled: Boolean(feedbackEvent),
    }
  );

  const {assign} = useMutateFeedback({
    feedbackIds: [feedbackIssue.id],
    organization,
    projectIds: [feedbackIssue.project.id],
  });

  const owners = getOwnerList([], eventOwners, feedbackIssue.assignedTo);

  // A new `key` will make the component re-render when showActorName changes
  const key = showActorName ? 'showActor' : 'hideActor';

  return (
    <DeprecatedAssigneeSelectorDropdown
      key={key}
      organization={organization}
      disabled={false}
      id={feedbackIssue.id}
      assignedTo={feedbackIssue.assignedTo}
      onAssign={() => {
        assign(feedbackIssue.assignedTo);
      }}
      onClear={() => {
        assign(null);
      }}
      owners={owners}
      group={feedbackIssue}
      alignMenu="right"
    >
      {({isOpen, getActorProps}) => (
        <Button size="xs" aria-label={t('Assigned dropdown')} {...getActorProps({})}>
          <ActorWrapper>
            {!feedbackIssue.assignedTo ? (
              <IconUser size="sm" />
            ) : (
              <ActorAvatar
                actor={feedbackIssue.assignedTo}
                hasTooltip={false}
                size={16}
              />
            )}
            {showActorName ? (
              <ActorName>
                {getAssignedToDisplayName(feedbackIssue) ?? t('Unassigned')}
              </ActorName>
            ) : null}
            <IconChevron direction={isOpen ? 'up' : 'down'} size="sm" />
          </ActorWrapper>
        </Button>
      )}
    </DeprecatedAssigneeSelectorDropdown>
  );
}

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  max-width: 150px;
  line-height: 1;
`;

const ActorName = styled('div')`
  line-height: 1.2;
  ${p => p.theme.overflowEllipsis}
  font-size: ${p => p.theme.fontSizeSmall};
`;
