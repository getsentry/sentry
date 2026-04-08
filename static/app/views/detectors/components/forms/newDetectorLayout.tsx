import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';

import type {FormProps} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';
import type {Data} from 'sentry/components/forms/types';
import {useFormEagerValidation} from 'sentry/components/forms/useFormEagerValidation';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import type {
  BaseDetectorUpdatePayload,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useProjects} from 'sentry/utils/useProjects';
import {NewDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {DetectorNameField} from 'sentry/views/detectors/components/forms/common/detectorNameField';
import {NewDetectorFooter} from 'sentry/views/detectors/components/forms/common/footer';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useCreateDetectorFormSubmit} from 'sentry/views/detectors/hooks/useCreateDetectorFormSubmit';

type NewDetectorLayoutProps<TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detectorType: DetectorType;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  initialFormData: Partial<TFormData>;
  disabledCreate?: string;
  extraFooterButton?: React.ReactNode;
  mapFormErrors?: (error: any) => any;
  previewChart?: React.ReactNode;
};

export function NewDetectorLayout<
  TFormData extends Data,
  TUpdatePayload extends BaseDetectorUpdatePayload,
>({
  children,
  formDataToEndpointPayload,
  initialFormData,
  disabledCreate,
  mapFormErrors,
  extraFooterButton,
  previewChart,
  detectorType,
}: NewDetectorLayoutProps<TFormData, TUpdatePayload>) {
  const location = useLocation();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const {projects} = useProjects();

  const initialProjectId = useMemo(() => {
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

  const formSubmitHandler = useCreateDetectorFormSubmit({
    detectorType,
    formDataToEndpointPayload,
  });

  const [formModel] = useState(() => new FormModel());
  const {onFieldChange} = useFormEagerValidation(formModel);

  const initialData = useMemo(() => {
    return {
      projectId: initialProjectId,
      environment: (location.query.environment as string | undefined) || '',
      name: (location.query.name as string | undefined) || '',
      owner: (location.query.owner as string | undefined) || '',
      workflowIds: [],
      ...initialFormData,
    };
  }, [
    initialProjectId,
    initialFormData,
    location.query.environment,
    location.query.name,
    location.query.owner,
  ]);

  const formProps: FormProps = {
    model: formModel,
    initialData,
    onSubmit: formSubmitHandler,
    onFieldChange,
    mapFormErrors,
  };

  return (
    <EditLayout formProps={formProps}>
      <EditLayout.Header maxWidth={maxWidth}>
        <EditLayout.HeaderContent>
          <NewDetectorBreadcrumbs detectorType={detectorType} />
        </EditLayout.HeaderContent>

        <div>
          <MonitorFeedbackButton />
        </div>

        <EditLayout.HeaderFields>
          <DetectorNameField />
          {previewChart ?? <div />}
        </EditLayout.HeaderFields>
      </EditLayout.Header>

      <EditLayout.Body maxWidth={maxWidth}>{children}</EditLayout.Body>

      <NewDetectorFooter
        maxWidth={maxWidth}
        disabledCreate={disabledCreate}
        extras={extraFooterButton}
      />
    </EditLayout>
  );
}
