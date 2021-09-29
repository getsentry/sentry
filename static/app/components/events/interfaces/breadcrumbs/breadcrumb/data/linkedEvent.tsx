import {useEffect, useState} from 'react';
import {InjectedRouter, PlainRoute} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Placeholder from 'app/components/placeholder';
import ShortId from 'app/components/shortId';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {EventIdResponse, Group, Organization, Project} from 'app/types';
import useApi from 'app/utils/useApi';
import useSessionStorage from 'app/utils/useSessionStorage';

type StoredLinkedEvent = {
  shortId: string;
  groupId: string;
  project: Project;
  orgSlug: Organization['slug'];
};

type Props = {
  orgSlug: Organization['slug'];
  eventId: string;
  router: InjectedRouter;
  route: PlainRoute;
};

function LinkedEvent({orgSlug, eventId, route, router}: Props) {
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
    if (!!storedLinkedEvent) {
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

      addErrorMessage(
        t('An error occured while fetching the data of the breadcrumb event link')
      );
      Sentry.captureException(error);

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

      addErrorMessage(
        t('An error occured while fetching the data of the breadcrumb event link')
      );
      Sentry.captureException(error);
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
      to={`/${orgSlug}/${project.slug}/issues/${groupId}/events/${eventId}/`}
    />
  );
}

export default LinkedEvent;

const StyledShortId = styled(ShortId)`
  font-weight: 700;
  display: inline-grid;
  margin-right: ${space(1)};
`;

const StyledPlaceholder = styled(Placeholder)`
  display: inline-flex;
  margin-right: ${space(1)};
`;
