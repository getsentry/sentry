import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {AssigneeSelectorDropdown} from 'sentry/components/assigneeSelectorDropdown';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import {
  EventOwners,
  getAssignedToDisplayName,
  getOwnerList,
} from 'sentry/components/group/assignedTo';
import {IconChevron, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackEvent: FeedbackEvent | undefined;
  feedbackIssue: FeedbackIssue;
}

export default function FeedbackAssignedTo({feedbackIssue, feedbackEvent}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const project = feedbackIssue.project;
  const [eventOwners, setEventOwners] = useState<EventOwners | null>(null);

  useEffect(() => {
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  useEffect(() => {
    if (!feedbackEvent) {
      return () => {};
    }

    let unmounted = false;

    api
      .requestPromise(
        `/projects/${organization.slug}/${project.slug}/events/${feedbackEvent.id}/owners/`
      )
      .then(response => {
        if (unmounted) {
          return;
        }

        setEventOwners(response);
      });

    return () => {
      unmounted = true;
      api.clear();
    };
  }, [api, feedbackEvent, organization, project.slug]);

  const {assign} = useMutateFeedback({
    feedbackIds: [feedbackIssue.id],
    organization,
  });

  const owners = getOwnerList([], eventOwners, feedbackIssue.assignedTo);

  const dropdown = (
    <AssigneeSelectorDropdown
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
            <ActorName>
              {getAssignedToDisplayName(feedbackIssue) ?? t('Unassigned')}
            </ActorName>
            <IconChevron direction={isOpen ? 'up' : 'down'} size="sm" />
          </ActorWrapper>
        </Button>
      )}
    </AssigneeSelectorDropdown>
  );

  return dropdown;
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
