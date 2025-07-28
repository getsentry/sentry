import {useMemo} from 'react';

import type {Data} from 'sentry/components/forms/types';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import type {
  BaseDetectorUpdatePayload,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {NewDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {NewDetectorFooter} from 'sentry/views/detectors/components/forms/common/footer';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {useCreateDetectorFormSubmit} from 'sentry/views/detectors/hooks/useCreateDetectorFormSubmit';

type NewDetectorLayoutProps<TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detectorType: DetectorType;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  initialFormData: Partial<TFormData>;
  previewChart?: React.ReactNode;
};

export function NewDetectorLayout<
  TFormData extends Data,
  TUpdatePayload extends BaseDetectorUpdatePayload,
>({
  children,
  formDataToEndpointPayload,
  initialFormData,
  previewChart,
  detectorType,
}: NewDetectorLayoutProps<TFormData, TUpdatePayload>) {
  const location = useLocation();
  const {projects} = useProjects();

  const formSubmitHandler = useCreateDetectorFormSubmit({
    formDataToEndpointPayload,
  });

  const initialData = useMemo(() => {
    const defaultProjectId = projects.find(p => p.isMember)?.id ?? projects[0]?.id;

    return {
      projectId: (location.query.project as string) ?? defaultProjectId ?? '',
      environment: (location.query.environment as string | undefined) || '',
      name: (location.query.name as string | undefined) || '',
      owner: (location.query.owner as string | undefined) || '',
      workflowIds: [],
      ...initialFormData,
    };
  }, [
    initialFormData,
    location.query.environment,
    location.query.name,
    location.query.owner,
    location.query.project,
    projects,
  ]);

  const formProps = {
    initialData,
    onSubmit: formSubmitHandler,
  };

  return (
    <EditLayout formProps={formProps}>
      <EditLayout.Header noActionWrap>
        <EditLayout.HeaderContent>
          <NewDetectorBreadcrumbs detectorType={detectorType} />
        </EditLayout.HeaderContent>

        <EditLayout.HeaderFields>
          <DetectorBaseFields />
          {previewChart}
        </EditLayout.HeaderFields>
      </EditLayout.Header>

      <EditLayout.Body>{children}</EditLayout.Body>

      <NewDetectorFooter />
    </EditLayout>
  );
}
