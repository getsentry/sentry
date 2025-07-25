import {useMemo} from 'react';

import type {Data} from 'sentry/components/forms/types';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {EditDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {EditDetectorActions} from 'sentry/views/detectors/components/forms/editDetectorActions';
import {useEditDetectorFormSubmit} from 'sentry/views/detectors/hooks/useEditDetectorFormSubmit';

type EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detector: TDetector;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  savedDetectorToFormData: (detector: TDetector) => TFormData;
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
}: EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload>) {
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
  };

  return (
    <EditLayout formProps={formProps}>
      <EditLayout.Header>
        <EditLayout.HeaderContent>
          <EditDetectorBreadcrumbs detector={detector} />
        </EditLayout.HeaderContent>

        <EditLayout.Actions>
          <EditDetectorActions detectorId={detector.id} />
        </EditLayout.Actions>

        <EditLayout.HeaderFields>
          <DetectorBaseFields />
          {previewChart}
        </EditLayout.HeaderFields>
      </EditLayout.Header>

      <EditLayout.Body>{children}</EditLayout.Body>
    </EditLayout>
  );
}
