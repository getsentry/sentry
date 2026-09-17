import {useTheme} from '@emotion/react';
import {z} from 'zod';

import {
  defaultFormOptions,
  setFieldErrors,
  useScrapsForm,
  useStore,
} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import type {PreprodDetector} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {requestErrorToFieldErrors} from 'sentry/utils/requestError/requestErrorToFieldErrors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {DetectorFormLayout} from 'sentry/views/detectors/components/forms/common/detectorFormLayout';
import {DetectorOwnershipSection} from 'sentry/views/detectors/components/forms/common/detectorOwnershipSection';
import {DetectorProjectSection} from 'sentry/views/detectors/components/forms/common/detectorProjectSection';
import {getDetectorSubmitTitle} from 'sentry/views/detectors/components/forms/common/getDetectorSubmitTitle';
import {useDetectorProject} from 'sentry/views/detectors/components/forms/common/useDetectorProject';
import {useInitialDetectorCommonValues} from 'sentry/views/detectors/components/forms/common/useInitialDetectorCommonValues';
import {useSubmitCreateDetector} from 'sentry/views/detectors/hooks/useSubmitCreateDetector';
import {useSubmitEditDetector} from 'sentry/views/detectors/hooks/useSubmitEditDetector';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';
import {STATUS_CHECK_ALLOWED_FILTER_KEYS} from 'sentry/views/settings/project/preprod/types';

import {MobileBuildDetectSection} from './detectSection';
import {
  PREPROD_DEFAULT_FORM_DATA,
  preprodFormDataToEndpointPayload,
  preprodSavedDetectorToFormData,
} from './mobileBuildFormData';
import {MobileBuildPreviewSection} from './previewSection';

const schema = z
  .object({
    name: z.string(),
    projectId: z.string().min(1, t('Required fields must be filled out')),
    description: z.string().nullable(),
    owner: z.string(),
    workflowIds: z.array(z.string()),
    measurement: z.enum(['install_size', 'download_size']),
    thresholdType: z.enum(['absolute', 'absolute_diff', 'relative_diff']),
    highThreshold: z.string(),
    lowThreshold: z.string(),
    query: z.string(),
  })
  .refine(values => !!values.highThreshold || !!values.lowThreshold, {
    path: ['highThreshold'],
    message: t('At least one threshold is required'),
  });

function MobileBuildDetectorForm({detector}: {detector?: PreprodDetector}) {
  const theme = useTheme();
  const organization = useOrganization();
  const commonValues = useInitialDetectorCommonValues();
  const initialValues = detector
    ? preprodSavedDetectorToFormData(detector)
    : {...commonValues, ...PREPROD_DEFAULT_FORM_DATA};
  const submitCreate = useSubmitCreateDetector();
  const submitEdit = useSubmitEditDetector();
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: initialValues,
    validators: {onChange: schema, onDynamic: schema},
    onSubmitInvalid: args => {
      defaultFormOptions.onSubmitInvalid(args);
      if (!detector) {
        trackAnalytics('monitor.created', {
          organization,
          detector_type: 'preprod_size_analysis',
          success: false,
        });
      }
    },
    onSubmit: ({value, formApi}) => {
      // Scraps disables automatic browser validation. Preserve the legacy number
      // inputs' native validity, including their step base, before sending data.
      const element = document.getElementById(formApi.formId);
      if (element instanceof HTMLFormElement && !element.reportValidity()) {
        return;
      }
      const payload = preprodFormDataToEndpointPayload(value);
      const onError = (error: unknown) => {
        if (error instanceof RequestError) {
          setFieldErrors(formApi, requestErrorToFieldErrors(error, formApi.state.values));
        }
      };
      return detector
        ? submitEdit({detectorId: detector.id, ...payload}, {onError})
        : submitCreate(payload, {onError});
    },
  });
  const projectId = useStore(form.store, state => state.values.projectId);
  const project = useDetectorProject(projectId);
  const canEdit = useCanEditDetector({
    projectId,
    detectorType: 'preprod_size_analysis',
  });
  return (
    <EditLayout>
      <form.AppForm form={form}>
        <DetectorFormLayout
          form={form}
          fields={{name: 'name'}}
          detectorType="preprod_size_analysis"
          detector={detector}
          submitButton={
            <form.Subscribe
              selector={state => ({
                isIncomplete: !state.values.projectId,
                isValid: state.isValid,
                projectId: state.values.projectId,
              })}
            >
              {state => (
                <form.SubmitButton
                  size={detector ? 'sm' : undefined}
                  disabled={state.isIncomplete || !state.isValid || !canEdit}
                  tooltipProps={{
                    title: getDetectorSubmitTitle(
                      state,
                      canEdit
                        ? undefined
                        : t(
                            'You do not have permission to create or edit monitors in this project'
                          )
                    ),
                  }}
                >
                  {detector ? t('Save') : t('Create Monitor')}
                </form.SubmitButton>
              )}
            </form.Subscribe>
          }
        >
          <Stack gap="2xl" maxWidth={theme.breakpoints.lg}>
            <DetectorProjectSection
              form={form}
              fields={{projectId: 'projectId'}}
              detectorType="preprod_size_analysis"
              detector={detector}
              step={1}
            />
            <MobileBuildDetectSection
              form={form}
              fields={{
                projectId: 'projectId',
                measurement: 'measurement',
                thresholdType: 'thresholdType',
                highThreshold: 'highThreshold',
                lowThreshold: 'lowThreshold',
              }}
            />
            <Container>
              <FormSection
                step={4}
                title={t('Filters')}
                description={t(
                  'Narrow down which builds are monitored by filtering on build attributes.'
                )}
              >
                <form.Subscribe selector={state => state.values.projectId}>
                  {selectedProjectId => (
                    <form.AppField name="query">
                      {field => (
                        <PreprodSearchBar
                          initialQuery={field.state.value}
                          projects={selectedProjectId ? [Number(selectedProjectId)] : []}
                          onSearch={field.handleChange}
                          searchSource="mobile_build_detector_form"
                          disallowFreeText
                          disallowHas
                          disallowLogicalOperators
                          allowedKeys={STATUS_CHECK_ALLOWED_FILTER_KEYS}
                        />
                      )}
                    </form.AppField>
                  )}
                </form.Subscribe>
              </FormSection>
            </Container>
            <DetectorOwnershipSection
              form={form}
              fields={{
                projectId: 'projectId',
                owner: 'owner',
                description: 'description',
              }}
              step={5}
            />
            <form.Subscribe selector={state => state.values}>
              {values => <MobileBuildPreviewSection values={values} step={6} />}
            </form.Subscribe>
            <AutomateSection
              form={form}
              fields={{workflowIds: 'workflowIds'}}
              project={project}
              step={7}
            />
          </Stack>
        </DetectorFormLayout>
      </form.AppForm>
    </EditLayout>
  );
}

export function NewPreprodDetectorForm() {
  return <MobileBuildDetectorForm />;
}

export function EditExistingPreprodDetectorForm({detector}: {detector: PreprodDetector}) {
  return <MobileBuildDetectorForm detector={detector} />;
}
