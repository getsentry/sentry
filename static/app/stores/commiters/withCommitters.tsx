import {useEffect} from 'react';

import {Client} from 'sentry/api';
import {
  AvatarProject,
  Committer,
  Event,
  Group,
  Organization,
  Project,
} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';
import useApi from 'sentry/utils/useApi';

import {makeCommitterStoreKey} from './committersReducer';
import {useCommitters} from './useCommitters';

function fetchCommitters(
  api: Client,
  params: {eventId: string; organizationSlug: string; projectSlug: string}
): Promise<{committers: Committer[]}> {
  return api.requestPromise(
    `/projects/${params.organizationSlug}/${params.projectSlug}/events/${params.eventId}/committers/`,
    {
      method: 'GET',
    }
  );
}

interface RequiredWithCommittersProps {
  event: Event;
  organization: Organization;
  project: Project | AvatarProject;
  group?: Group;
}

export interface WithCommittersProps {
  committers: Committer[] | undefined;
}

export function withCommitters<P extends WithCommittersProps>(
  Component: React.ComponentType<P>
) {
  const wrappedComponent: React.ComponentType<
    Omit<P, keyof WithCommittersProps> & RequiredWithCommittersProps
  > = (props): React.ReactElement => {
    const api = useApi();
    const [state, dispatch] = useCommitters();

    useEffect(() => {
      if (!props.group?.firstRelease) {
        return undefined;
      }

      const key = makeCommitterStoreKey({
        organizationSlug: props.organization.slug,
        projectSlug: props.project.slug,
        eventId: props.event.id,
      });

      if (state[key]?.committers || state[key]?.committersLoading) {
        return undefined;
      }

      dispatch({
        type: 'start loading',
        payload: {
          eventId: props.event.id,
          organizationSlug: props.organization.slug,
          projectSlug: props.project.slug,
        },
      });

      let unmounted = false;

      fetchCommitters(api, {
        organizationSlug: props.organization.slug,
        projectSlug: props.project.slug,
        eventId: props.event.id,
      })
        .then(response => {
          if (unmounted) {
            return;
          }

          dispatch({
            type: 'add committers',
            payload: {
              committers: response.committers,
              eventId: props.event.id,
              organizationSlug: props.organization.slug,
              projectSlug: props.project.slug,
            },
          });
        })
        .catch(() => {
          if (unmounted) {
            return;
          }
          dispatch({
            type: 'set error',
            payload: {
              eventId: props.event.id,
              organizationSlug: props.organization.slug,
              projectSlug: props.project.slug,
            },
          });
        });

      return () => {
        unmounted = true;
      };
    }, [props.group, props.organization.slug, props.project.slug, props.event.id]);

    const key = makeCommitterStoreKey({
      organizationSlug: props.organization.slug,
      projectSlug: props.project.slug,
      eventId: props.event.id,
    });

    return (
      <Component {...(props as unknown as P)} committers={state[key]?.committers ?? []} />
    );
  };

  wrappedComponent.displayName = `withCommitters(${getDisplayName(Component)})`;
  return wrappedComponent;
}
