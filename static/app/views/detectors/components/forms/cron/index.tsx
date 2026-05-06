import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
  withForm,
} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import type {CronDetector} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar} from 'sentry/utils/queryString';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  DeleteDetectorAction,
  DisableDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {DetectorFormBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {IssueOwnershipSection} from 'sentry/views/detectors/components/forms/common/issueOwnershipSection';
import {ProjectField} from 'sentry/views/detectors/components/forms/common/projectField';
import {ProjectSection} from 'sentry/views/detectors/components/forms/common/projectSection';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useSubmitCreateDetector} from 'sentry/views/detectors/hooks/useSubmitCreateDetector';
import {useSubmitEditDetector} from 'sentry/views/detectors/hooks/useSubmitEditDetector';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {getNoPermissionToEditMonitorTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanEditDetectorWorkflowConnections} from 'sentry/views/detectors/utils/useCanEditDetector';
import {useCronsUpsertGuideState} from 'sentry/views/insights/crons/components/useCronsUpsertGuideState';
import type {MonitorIntervalUnit} from 'sentry/views/insights/crons/types';

import {CronIssuePreview} from './cronIssuePreview';
import {CronDetectSection} from './detect';
import {
  CRON_DEFAULT_FORM_VALUES,
  cronDetectorFormSchema,
  cronFormDataToEndpointPayload,
  cronSavedDetectorToFormData,
} from './fields';
import {InstrumentationGuide} from './instrumentationGuide';
import {PreviewSection} from './previewSection';
import {CronResolveSection} from './resolve';

function useIsShowingPlatformGuide() {
  const {platformKey, guideKey} = useCronsUpsertGuideState();
  return platformKey && guideKey !== 'manual';
}

function useInitialProjectId() {
  const location = useLocation();
  const {projects} = useProjects();

  return useMemo(() => {
    const queryProjectId = location.query.project as string | undefined;
    if (queryProjectId) {
      const match = projects.find(p => p.id === queryProjectId);
      if (match) {
        return match.id;
      }
    }
    const sorted = orderBy(projects, ['isMember', 'isBookmarked'], ['desc', 'desc']);
    return sorted[0]?.id ?? '';
  }, [location.query.project, projects]);
}

export function NewCronDetectorForm() {
  const organization = useOrganization();
  const location = useLocation();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const showingPlatformGuide = useIsShowingPlatformGuide();

  const initialProjectId = useInitialProjectId();
  const submitCreateDetector = useSubmitCreateDetector({
    detectorType: 'monitor_check_in_failure',
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      ...CRON_DEFAULT_FORM_VALUES,
      projectId: initialProjectId,
      name: decodeScalar(location.query.name) ?? '',
      owner: decodeScalar(location.query.owner) || null,
    },
    validators: {onDynamic: cronDetectorFormSchema},
    onSubmit: async ({value, formApi}) => {
      const payload = cronFormDataToEndpointPayload(value);
      await submitCreateDetector(payload, {
        onError: error => {
          if (error instanceof RequestError) {
            const mapped = mapResponseErrorsToFields(error);
            setFieldErrors(formApi, mapped);
          }
        },
      });
    },
  });

  return (
    <EditLayout>
      <form.AppForm form={form}>
        <DetectorFormBreadcrumbs form={form} />
        <MonitorFeedbackButton />

        <EditLayout.Body maxWidth={maxWidth}>
          <CronDetectorFormBody form={form} />
        </EditLayout.Body>

        <EditLayout.Footer label={t('Step 2 of 2')} maxWidth={maxWidth}>
          <LinkButton
            variant="secondary"
            to={`${makeMonitorBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <form.SubmitButton
            disabled={!!showingPlatformGuide}
            tooltipProps={{
              title: showingPlatformGuide
                ? t(
                    'Using Auto-Instrumentation does not require you to create a monitor via the Sentry UI'
                  )
                : undefined,
            }}
          >
            {t('Create Monitor')}
          </form.SubmitButton>
        </EditLayout.Footer>
      </form.AppForm>
    </EditLayout>
  );
}

export function EditExistingCronDetectorForm({detector}: {detector: CronDetector}) {
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const canEditWorkflowConnections = useCanEditDetectorWorkflowConnections({
    projectId: detector.projectId,
  });
  const submitEditDetector = useSubmitEditDetector();

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: cronSavedDetectorToFormData(detector),
    validators: {onDynamic: cronDetectorFormSchema},
    onSubmit: async ({value, formApi}) => {
      const payload = cronFormDataToEndpointPayload(value);
      await submitEditDetector(
        {detectorId: detector.id, ...payload},
        {
          onError: error => {
            if (error instanceof RequestError) {
              const mapped = mapResponseErrorsToFields(error);
              setFieldErrors(formApi, mapped);
            }
          },
        }
      );
    },
  });

  return (
    <EditLayout>
      <form.AppForm form={form}>
        <DetectorFormBreadcrumbs form={form} />
        <MonitorFeedbackButton />

        <EditLayout.Body maxWidth={maxWidth}>
          <CronDetectorFormBody form={form} detector={detector} />
        </EditLayout.Body>

        <EditLayout.Footer maxWidth={maxWidth}>
          <DisableDetectorAction detector={detector} />
          <DeleteDetectorAction detector={detector} />
          <form.SubmitButton
            size="sm"
            disabled={!canEditWorkflowConnections}
            tooltipProps={{
              title: canEditWorkflowConnections
                ? undefined
                : getNoPermissionToEditMonitorTooltip(),
            }}
          >
            {t('Save')}
          </form.SubmitButton>
        </EditLayout.Footer>
      </form.AppForm>
    </EditLayout>
  );
}

const CronDetectorFormBody = withForm({
  defaultValues: CRON_DEFAULT_FORM_VALUES,
  validators: {onDynamic: cronDetectorFormSchema},
  props: {} as {
    detector?: CronDetector;
  },
  render: function CronDetectorFormBody({form, detector}) {
    const theme = useTheme();
    const showingPlatformGuide = useIsShowingPlatformGuide();
    const {projects} = useProjects();
    const dataSource = detector?.dataSources[0];

    return (
      <form.Subscribe>
        {state => {
          const values = state.values;
          const project = projects.find(p => p.id === values.projectId);

          return (
            <Stack gap="2xl" maxWidth={theme.breakpoints.xl}>
              {!detector && <InstrumentationGuide projectId={values.projectId} />}
              <Stack
                data-test-id="form-sections"
                style={showingPlatformGuide ? {display: 'none'} : undefined}
                gap="2xl"
              >
                {dataSource?.queryObj.isUpserting && (
                  <Alert variant="warning">
                    {t(
                      'This monitor is managed in code and updates automatically with each check-in. Changes made here may be overwritten!'
                    )}
                  </Alert>
                )}
                <PreviewSection
                  scheduleType={values.scheduleType}
                  scheduleCrontab={values.scheduleCrontab}
                  scheduleIntervalValue={values.scheduleIntervalValue}
                  scheduleIntervalUnit={
                    values.scheduleIntervalUnit as MonitorIntervalUnit
                  }
                  timezone={values.timezone}
                  failureIssueThreshold={values.failureIssueThreshold}
                  recoveryThreshold={values.recoveryThreshold}
                />
                <ProjectSection step={1}>
                  <ProjectField form={form} fields={{projectId: 'projectId'}} />
                </ProjectSection>
                <CronDetectSection
                  form={form}
                  fields={{
                    scheduleType: 'scheduleType',
                    scheduleCrontab: 'scheduleCrontab',
                    scheduleIntervalValue: 'scheduleIntervalValue',
                    scheduleIntervalUnit: 'scheduleIntervalUnit',
                    timezone: 'timezone',
                    checkinMargin: 'checkinMargin',
                    maxRuntime: 'maxRuntime',
                    failureIssueThreshold: 'failureIssueThreshold',
                  }}
                  step={2}
                />
                <CronResolveSection
                  form={form}
                  fields={{recoveryThreshold: 'recoveryThreshold'}}
                  step={3}
                />
                <IssueOwnershipSection
                  form={form}
                  fields={{owner: 'owner', description: 'description'}}
                  step={4}
                  projectId={values.projectId}
                />
                {project && (
                  <Fragment>
                    <CronIssuePreview
                      step={5}
                      name={values.name}
                      owner={values.owner}
                      project={project}
                    />
                    <AutomateSection
                      form={form}
                      fields={{workflowIds: 'workflowIds'}}
                      step={6}
                      project={project}
                    />
                  </Fragment>
                )}
              </Stack>
            </Stack>
          );
        }}
      </form.Subscribe>
    );
  },
});

function mapResponseErrorsToFields(
  requestError: RequestError
): Record<string, {message: string}> | RequestError {
  if (
    typeof requestError.responseJSON !== 'object' ||
    requestError.responseJSON === null
  ) {
    return requestError;
  }

  // The API response may return an error like: `dataSources: {slug: ['The slug "new-test-cron-job" is already in use.']}`.
  // In this case we want to map that to the `name` field.
  if ('dataSources' in requestError.responseJSON) {
    if (typeof requestError.responseJSON.dataSources === 'object') {
      if (
        requestError.responseJSON.dataSources &&
        'slug' in requestError.responseJSON.dataSources
      ) {
        return {
          name: {
            message: Array.isArray(requestError.responseJSON.dataSources.slug)
              ? requestError.responseJSON.dataSources.slug[0]
              : requestError.responseJSON.dataSources.slug,
          },
        };
      }
    }
  }

  return requestError;
}
