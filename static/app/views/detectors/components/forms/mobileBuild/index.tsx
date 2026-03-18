import {useCallback, useContext} from 'react';
import {useTheme} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import FormContext from 'sentry/components/forms/formContext';
import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {PreprodDetector} from 'sentry/types/workflowEngine/detectors';
import {AutomateSection} from 'sentry/views/detectors/components/forms/automateSection';
import {AssignSection} from 'sentry/views/detectors/components/forms/common/assignSection';
import {DescribeSection} from 'sentry/views/detectors/components/forms/common/describeSection';
import {EditDetectorLayout} from 'sentry/views/detectors/components/forms/editDetectorLayout';
import {MobileBuildDetectSection} from 'sentry/views/detectors/components/forms/mobileBuild/detectSection';
import {
  PREPROD_DEFAULT_FORM_DATA,
  PREPROD_DETECTOR_FORM_FIELDS,
  preprodFormDataToEndpointPayload,
  preprodSavedDetectorToFormData,
  usePreprodDetectorFormField,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {MobileBuildPreviewSection} from 'sentry/views/detectors/components/forms/mobileBuild/previewSection';
import {NewDetectorLayout} from 'sentry/views/detectors/components/forms/newDetectorLayout';
import {STATUS_CHECK_ALLOWED_FILTER_KEYS} from 'sentry/views/settings/project/preprod/types';

function MobileBuildDetectorForm() {
  const theme = useTheme();
  const {form} = useContext(FormContext);
  const query = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.query) ?? '';
  const projectId = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.projectId);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      form?.setValue(PREPROD_DETECTOR_FORM_FIELDS.query, searchQuery);
    },
    [form]
  );

  return (
    <Stack gap="2xl" maxWidth={theme.breakpoints.lg}>
      <MobileBuildDetectSection />
      <Container>
        <Section
          title={t('Filters')}
          description={t(
            'Narrow down which builds are monitored by filtering on build attributes.'
          )}
        >
          <PreprodSearchBar
            initialQuery={query}
            projects={projectId ? [Number(projectId)] : []}
            onSearch={handleSearch}
            searchSource="mobile_build_detector_form"
            disallowFreeText
            disallowHas
            disallowLogicalOperators
            allowedKeys={STATUS_CHECK_ALLOWED_FILTER_KEYS}
          />
        </Section>
      </Container>
      <MobileBuildPreviewSection />
      <AssignSection />
      <DescribeSection />
      <AutomateSection />
    </Stack>
  );
}

export function NewPreprodDetectorForm() {
  return (
    <NewDetectorLayout
      detectorType="preprod_size_analysis"
      formDataToEndpointPayload={preprodFormDataToEndpointPayload}
      initialFormData={PREPROD_DEFAULT_FORM_DATA}
      environment={false}
    >
      <MobileBuildDetectorForm />
    </NewDetectorLayout>
  );
}

export function EditExistingPreprodDetectorForm({detector}: {detector: PreprodDetector}) {
  return (
    <EditDetectorLayout
      detector={detector}
      formDataToEndpointPayload={preprodFormDataToEndpointPayload}
      savedDetectorToFormData={preprodSavedDetectorToFormData}
      environment={false}
    >
      <MobileBuildDetectorForm />
    </EditDetectorLayout>
  );
}
