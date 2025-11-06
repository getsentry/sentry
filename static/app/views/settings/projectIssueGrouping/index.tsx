import {hasEveryAccess} from 'sentry/components/acl/access';
import {ExternalLink} from 'sentry/components/core/link';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {fields} from 'sentry/data/forms/projectIssueGrouping';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {EventGroupingConfig} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApiQuery} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

export default function ProjectIssueGrouping() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();

  const queryKey = `/projects/${organization.slug}/${project.slug}/grouping-configs/`;
  const {
    data: groupingConfigs,
    isPending,
    isError,
    refetch,
  } = useApiQuery<EventGroupingConfig[]>([queryKey], {staleTime: 0, gcTime: 0});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError message={t('Failed to load grouping configs')} onRetry={refetch} />
    );
  }

  const handleSubmit = (response: Project) => {
    // This will update our project context
    ProjectsStore.onUpdateSuccess(response);
  };

  const endpoint = `/projects/${organization.slug}/${project.slug}/`;

  const access = new Set(organization.access.concat(project.access));
  const activeSuperUser = isActiveSuperuser();
  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  const jsonFormProps = {
    additionalFieldProps: {
      organization,
      groupingConfigs,
    },
    features: new Set(organization.features),
    access,
    disabled: !hasAccess,
  };

  return (
    <SentryDocumentTitle title={routeTitleGen(t('Issue Grouping'), project.slug, false)}>
      <SettingsPageHeader title={t('Issue Grouping')} />

      <TextBlock>
        {tct(
          `All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link: read the docs].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/" />
            ),
          }
        )}
      </TextBlock>

      <ProjectPermissionAlert project={project} />

      <Form
        saveOnBlur
        allowUndo
        initialData={project}
        apiMethod="PUT"
        apiEndpoint={endpoint}
        onSubmitSuccess={handleSubmit}
      >
        <JsonForm
          {...jsonFormProps}
          title={t('Fingerprint Rules')}
          fields={[fields.fingerprintingRules]}
        />

        <JsonForm
          {...jsonFormProps}
          title={t('Stack Trace Rules')}
          fields={[fields.groupingEnhancements]}
        />

        {activeSuperUser && (
          <JsonForm
            {...jsonFormProps}
            title={t('Derived Grouping Enhancements')}
            fields={[fields.derivedGroupingEnhancements]}
            disabled
          />
        )}
      </Form>
    </SentryDocumentTitle>
  );
}
