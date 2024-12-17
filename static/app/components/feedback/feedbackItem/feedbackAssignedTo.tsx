import {useEffect} from 'react';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import type {EventOwners} from 'sentry/components/group/assignedTo';
import {getOwnerList} from 'sentry/components/group/assignedTo';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import type {Actor} from 'sentry/types/core';
import type {Group} from 'sentry/types/group';
import type {FeedbackEvent} from 'sentry/utils/feedback/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackEvent: FeedbackEvent;
  feedbackIssue: Group;
}

export default function FeedbackAssignedTo({feedbackIssue, feedbackEvent}: Props) {
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
  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group: feedbackIssue,
  });

  const {assign} = useMutateFeedback({
    feedbackIds: [feedbackIssue.id],
    organization,
    projectIds: [feedbackIssue.project.id],
  });

  const owners = getOwnerList([], eventOwners, feedbackIssue.assignedTo);

  return (
    <AssigneeSelector
      group={feedbackIssue}
      owners={owners}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={e => {
        assign(e?.assignee as Actor);
        handleAssigneeChange(e);
      }}
    />
  );
}
