import {
  getErrorMessage,
  type ErrorMessage,
} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {
  shouldErrorBeShown,
  useFetchProguardMappingFiles,
} from 'sentry/components/events/interfaces/crashContent/exception/actionableItemsUtils';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ActionableItemErrors} from './actionableItemsUtils';

const actionableItemsQuery = ({
  orgSlug,
  projectSlug,
  eventId,
}: UseActionableItemsProps): ApiQueryKey => [
  getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/actionable-items/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug,
        eventId,
      },
    }
  ),
];

interface ActionableItemsResponse {
  errors: ActionableItemErrors[];
}

interface UseActionableItemsProps {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

function useActionableItems(props?: UseActionableItemsProps) {
  return useApiQuery<ActionableItemsResponse>(
    props ? actionableItemsQuery(props) : ([''] as unknown as ApiQueryKey),
    {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ['data'],
      enabled: defined(props),
    }
  );
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
