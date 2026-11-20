import {hasEveryAccess} from 'sentry/components/acl/access';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';

export function useCanEditClassifier(classifier: TelemetryClassifier) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: classifier.projectId});
  return hasEveryAccess(['project:read'], {organization, project});
}
