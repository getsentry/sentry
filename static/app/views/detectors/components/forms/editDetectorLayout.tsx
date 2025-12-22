import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/core/button';
import type {Data} from 'sentry/components/forms/types';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {
  DeleteDetectorAction,
  DisableDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {EditDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useEditDetectorFormSubmit} from 'sentry/views/detectors/hooks/useEditDetectorFormSubmit';

type EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detector: TDetector;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  savedDetectorToFormData: (detector: TDetector) => TFormData;
  envFieldProps?: React.ComponentProps<typeof DetectorBaseFields>['envFieldProps'];
  mapFormErrors?: (error: any) => any;
  noEnvironment?: boolean;
  previewChart?: React.ReactNode;
};

export function EditDetectorLayout<
  TDetector extends Detector,
  TFormData extends Data,
  TUpdatePayload extends BaseDetectorUpdatePayload,
>({
  previewChart,
  detector,
  children,
  formDataToEndpointPayload,
  savedDetectorToFormData,
  mapFormErrors,
  noEnvironment,
  envFieldProps,
}: EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload>) {
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;

  const handleFormSubmit = useEditDetectorFormSubmit({
    detector,
    formDataToEndpointPayload,
  });

  const initialData = useMemo(() => {
    return savedDetectorToFormData(detector);
  }, [detector, savedDetectorToFormData]);

  const formProps = {
    initialData,
    onSubmit: handleFormSubmit,
    mapFormErrors,
  };

  return (
    <EditLayout formProps={formProps}>
      <EditLayout.Header maxWidth={maxWidth}>
        <EditLayout.HeaderContent>
          <EditDetectorBreadcrumbs detector={detector} />
        </EditLayout.HeaderContent>

        <div>
          <EditLayout.Actions>
            <MonitorFeedbackButton />
          </EditLayout.Actions>
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

      <EditLayout.Footer maxWidth={maxWidth}>
        <DisableDetectorAction detector={detector} />
        <DeleteDetectorAction detector={detector} />
        <Button type="submit" priority="primary" size="sm">
          {t('Save')}
        </Button>
      </EditLayout.Footer>
    </EditLayout>
  );
}
