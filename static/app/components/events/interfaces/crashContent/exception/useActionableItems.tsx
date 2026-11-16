import {skipToken, useQuery} from '@tanstack/react-query';

import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {getErrorMessage, type ErrorMessage} from './actionableItems';
import {shouldErrorBeShown, useFetchProguardMappingFiles} from './actionableItemsUtils';
import type {ActionableItemErrors} from './actionableItemsUtils';

interface ActionableItemsResponse {
  errors: ActionableItemErrors[];
}

interface UseActionableItemsProps {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

function useActionableItems(props?: UseActionableItemsProps) {
  return useQuery({
    ...apiOptions.as<ActionableItemsResponse>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/actionable-items/',
      {
        path: props
          ? {
              organizationIdOrSlug: props.orgSlug,
              projectIdOrSlug: props.projectSlug,
              eventId: props.eventId,
            }
          : skipToken,
        staleTime: Infinity,
      }
    ),
    retry: false,
    refetchOnWindowFocus: false,
    notifyOnChangeProps: ['data'],
  });
}

export function useActionableItemsWithProguardErrors({
  event,
  project,
  isShare,
}: {
  event: Event;
  isShare: boolean;
  project: Project;
}): ErrorMessage[] | null {
  const organization = useOrganization();
  const {data: actionableItems, isPending: actionableItemsPending} = useActionableItems({
    eventId: event.id,
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const {proguardErrors, proguardErrorsLoading} = useFetchProguardMappingFiles({
    event,
    project,
    isShare,
  });

  if (actionableItemsPending || !actionableItems || proguardErrorsLoading) {
    return null;
  }

  const {_meta} = event;
  const errors = [...actionableItems.errors, ...proguardErrors]
    .filter(error => shouldErrorBeShown(error, event))
    .flatMap((error, errorIdx) =>
      getErrorMessage(error, _meta?.errors?.[errorIdx]).map(message => ({
        ...message,
        type: error.type,
      }))
    );

  if (!errors.length) {
    return null;
  }
  return errors;
}
