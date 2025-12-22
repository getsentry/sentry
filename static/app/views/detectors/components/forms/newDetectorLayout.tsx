import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {FormProps} from 'sentry/components/forms/form';
import type {Data} from 'sentry/components/forms/types';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import type {
  BaseDetectorUpdatePayload,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {NewDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {NewDetectorFooter} from 'sentry/views/detectors/components/forms/common/footer';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useCreateDetectorFormSubmit} from 'sentry/views/detectors/hooks/useCreateDetectorFormSubmit';

type NewDetectorLayoutProps<TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detectorType: DetectorType;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  initialFormData: Partial<TFormData>;
  disabledCreate?: string;
  envFieldProps?: React.ComponentProps<typeof DetectorBaseFields>['envFieldProps'];
  mapFormErrors?: (error: any) => any;
  noEnvironment?: boolean;
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
  noEnvironment,
  envFieldProps,
  previewChart,
  detectorType,
}: NewDetectorLayoutProps<TFormData, TUpdatePayload>) {
  const location = useLocation();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const formContext = useDetectorFormContext();

  const formSubmitHandler = useCreateDetectorFormSubmit({
    detectorType,
    formDataToEndpointPayload,
  });

  const initialData = useMemo(() => {
    return {
      projectId: formContext.project.id,
      environment: (location.query.environment as string | undefined) || '',
      name: (location.query.name as string | undefined) || '',
      owner: (location.query.owner as string | undefined) || '',
      workflowIds: [],
      ...initialFormData,
    };
  }, [
    formContext.project.id,
    initialFormData,
    location.query.environment,
    location.query.name,
    location.query.owner,
  ]);

  const formProps: FormProps = {
    initialData,
    onSubmit: formSubmitHandler,
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
          <DetectorBaseFields
            noEnvironment={noEnvironment}
            envFieldProps={envFieldProps}
          />
          {previewChart ?? <div />}
        </EditLayout.HeaderFields>
      </EditLayout.Header>

      <EditLayout.Body maxWidth={maxWidth}>{children}</EditLayout.Body>

      <NewDetectorFooter maxWidth={maxWidth} disabledCreate={disabledCreate} />
    </EditLayout>
  );
}
