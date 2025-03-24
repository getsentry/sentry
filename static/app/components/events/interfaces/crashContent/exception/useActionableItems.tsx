import {
  type ErrorMessage,
  getErrorMessage,
} from 'sentry/components/events/interfaces/crashContent/exception/actionableItems';
import {
  shouldErrorBeShown,
  useFetchProguardMappingFiles,
} from 'sentry/components/events/interfaces/crashContent/exception/actionableItemsUtils';
import type {Event} from 'sentry/types/event';
import type {Organization, SharedViewOrganization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import type {ActionableItemErrors} from './actionableItemsUtils';

const actionableItemsQuery = ({
  orgSlug,
  projectSlug,
  eventId,
}: UseActionableItemsProps): ApiQueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/actionable-items/`,
];

export interface ActionableItemsResponse {
  errors: ActionableItemErrors[];
}

interface UseActionableItemsProps {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

export function useActionableItems(props?: UseActionableItemsProps) {
  return useApiQuery<ActionableItemsResponse>(
    props ? actionableItemsQuery(props) : [''],
    {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ['data'],
      enabled: defined(props),
    }
  );
}

/**
 * Check we have all required props
 */
export function actionableItemsEnabled({
  eventId,
  organization,
  projectSlug,
}: {
  eventId?: string;
  organization?: Organization | SharedViewOrganization | null;
  projectSlug?: string;
}) {
  if (!organization || !organization.features || !projectSlug || !eventId) {
    return false;
  }
  return true;
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
