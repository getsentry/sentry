import {useEffect, useState} from 'react';
import {InjectedRouter, PlainRoute} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import ShortId from 'sentry/components/shortId';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventIdResponse, Group, Organization, Project} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useSessionStorage from 'sentry/utils/useSessionStorage';

type StoredLinkedEvent = {
  groupId: string;
  orgSlug: Organization['slug'];
  project: Project;
  shortId: string;
};

type Props = {
  eventId: string;
  orgSlug: Organization['slug'];
  route: PlainRoute;
  router: InjectedRouter;
};

const errorMessage = t(
  'An error occurred while fetching the data of the breadcrumb event link'
);

export function LinkedEvent({orgSlug, eventId, route, router}: Props) {
  const [storedLinkedEvent, setStoredLinkedEvent, removeStoredLinkedEvent] =
    useSessionStorage<undefined | StoredLinkedEvent>(eventId);

  const [eventIdLookup, setEventIdLookup] = useState<undefined | EventIdResponse>();
  const [hasError, setHasError] = useState(false);

  const api = useApi();

  useEffect(() => {
    fetchEventById();
    router.setRouteLeaveHook(route, onRouteLeave);
  }, []);

  useEffect(() => {
    fetchIssueByGroupId();
  }, [eventIdLookup]);

  function onRouteLeave() {
    removeStoredLinkedEvent();
  }

  async function fetchEventById() {
    if (storedLinkedEvent) {
      return;
    }

    try {
      const response = await api.requestPromise(
        `/organizations/${orgSlug}/eventids/${eventId}/`
      );

      setEventIdLookup(response);
    } catch (error) {
      setHasError(true);

      if (error.status === 404) {
        return;
      }

      addErrorMessage(errorMessage);
      handleXhrErrorResponse(errorMessage)(error);

      // do nothing. The link won't be displayed
    }
  }

  async function fetchIssueByGroupId() {
    if (!!storedLinkedEvent || !eventIdLookup) {
      return;
    }

    try {
      const response = await api.requestPromise(
        `/organizations/${orgSlug}/issues/${eventIdLookup.groupId}/`
      );

      const {project, shortId} = response as Group;
      const {groupId} = eventIdLookup;
      setStoredLinkedEvent({shortId, project, groupId, orgSlug});
    } catch (error) {
      setHasError(true);

      if (error.status === 404) {
        return;
      }

      addErrorMessage(errorMessage);
      handleXhrErrorResponse('An error occurred while fetching an issue')(error);

      // do nothing. The link won't be displayed
    }
  }

  if (hasError) {
    return null;
  }

  if (!storedLinkedEvent) {
    return <StyledPlaceholder height="16px" width="109px" />;
  }

  const {shortId, project, groupId} = storedLinkedEvent;

  return (
    <StyledShortId
      shortId={shortId}
      avatar={<ProjectBadge project={project} avatarSize={16} hideName />}
      to={`/${orgSlug}/${project.slug}/issues/${groupId}/events/${eventId}/?referrer=linked-event`}
    />
  );
}

const StyledShortId = styled(ShortId)`
  font-weight: 700;
  display: inline-grid;
  margin-right: ${space(1)};
`;

const StyledPlaceholder = styled(Placeholder)`
  display: inline-flex;
  margin-right: ${space(1)};
`;
