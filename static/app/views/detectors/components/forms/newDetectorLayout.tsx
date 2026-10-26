import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';

import type {FormProps} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';
import type {Data} from 'sentry/components/forms/types';
import {useFormEagerValidation} from 'sentry/components/forms/useFormEagerValidation';
import {EditLayoutDeprecated} from 'sentry/components/workflowEngine/layout/edit';
import type {
  BaseDetectorUpdatePayload,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {DetectorFormBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {NewDetectorFooter} from 'sentry/views/detectors/components/forms/common/footer';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useCreateDetectorFormSubmit} from 'sentry/views/detectors/hooks/useCreateDetectorFormSubmit';
import {hasDetectorWriteAccess} from 'sentry/views/detectors/utils/permissions';

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
  const organization = useOrganization();
  const {projects} = useProjects();

  const initialProjectId = useMemo(() => {
    const writableProjects = projects.filter(project =>
      hasDetectorWriteAccess({organization, project})
    );
    const queryProjectId = decodeScalar(location.query.project);
    if (queryProjectId) {
      const match = writableProjects.find(p => p.id === queryProjectId);
      if (match) {
        return match.id;
      }
    }
    const sorted = orderBy(
      writableProjects,
      ['isMember', 'isBookmarked'],
      ['desc', 'desc']
    );
    return sorted[0]?.id ?? '';
  }, [location.query.project, organization, projects]);

  const formSubmitHandler = useCreateDetectorFormSubmit({
    detectorType,
    formDataToEndpointPayload,
  });

  const [formModel] = useState(() => new FormModel());
  const {onFieldChange} = useFormEagerValidation(formModel);

  const initialEnvironment = decodeScalar(location.query.environment, '');
  const initialData = useMemo(() => {
    return {
      projectId: initialProjectId,
      environment: initialEnvironment,
      name: '',
      owner: '',
      workflowIds: [],
      ...initialFormData,
    };
  }, [initialProjectId, initialEnvironment, initialFormData]);

  const formProps: FormProps = {
    model: formModel,
    initialData,
    onSubmit: formSubmitHandler,
    onFieldChange,
    mapFormErrors,
  };

  return (
    <EditLayoutDeprecated formProps={formProps}>
      <EditLayoutDeprecated.Header maxWidth={maxWidth}>
        <DetectorFormBreadcrumbs />

        <div>
          <MonitorFeedbackButton />
        </div>

        {previewChart && (
          <EditLayoutDeprecated.HeaderFields>
            {previewChart}
          </EditLayoutDeprecated.HeaderFields>
        )}
      </EditLayoutDeprecated.Header>

      <EditLayoutDeprecated.Body maxWidth={maxWidth}>
        {children}
      </EditLayoutDeprecated.Body>

      <NewDetectorFooter
        maxWidth={maxWidth}
        disabledCreate={disabledCreate}
        extras={extraFooterButton}
      />
    </EditLayoutDeprecated>
  );
}
