import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {AssigneeSelectorDropdown} from 'sentry/components/assigneeSelectorDropdown';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import {
  EventOwners,
  getAssignedToDisplayName,
  getOwnerList,
} from 'sentry/components/group/assignedTo';
import {IconChevron, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {FeedbackEvent, FeedbackIssue} from 'sentry/utils/feedback/types';
import useApi from 'sentry/utils/useApi';
import useCommitters from 'sentry/utils/useCommitters';
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
  const {data} = useCommitters(
    {
      eventId: feedbackEvent?.id ?? '',
      projectSlug: project.slug,
    },
    {
      notifyOnChangeProps: ['data'],
      enabled: defined(feedbackEvent?.id),
    }
  );

  useEffect(() => {
    // TODO: We should check if this is already loaded
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

  const owners = getOwnerList(
    data?.committers ?? [],
    eventOwners,
    feedbackIssue.assignedTo
  );

  const dropdown = (
    <AssigneeSelectorDropdown
      organization={organization}
      disabled={false}
      id={feedbackIssue.id}
      assignedTo={feedbackIssue.assignedTo}
      onAssign={() => {}}
      owners={owners}
    >
      {({loading, isOpen, getActorProps}) => (
        <Button size="xs" aria-label={t('Assigned dropdown')} {...getActorProps({})}>
          <ActorWrapper>
            {loading || !feedbackIssue.assignedTo ? (
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
