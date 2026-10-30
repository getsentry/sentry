import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import omitBy from 'lodash/omitBy';
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
import {
  useDetectorDraft,
  type DetectorDraftSchema,
} from 'sentry/views/detectors/components/forms/common/detectorDraft';
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
  draftSchema?: DetectorDraftSchema<TFormData>;
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
  draftSchema,
}: NewDetectorLayoutProps<TFormData, TUpdatePayload>) {
  const location = useLocation();
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const organization = useOrganization();
  const {projects} = useProjects();

  const [formModel] = useState(() => new FormModel());
  const {initialValues: draftFormData, onFieldChange: syncDraftToUrl} = useDetectorDraft(
    formModel,
    draftSchema
  );

  const initialProjectId = useMemo(() => {
    const writableProjects = projects.filter(project =>
      hasDetectorWriteAccess({organization, project})
    );
    const requestedProjectId = [
      draftFormData?.projectId,
      decodeScalar(location.query.project),
    ].find(id => writableProjects.some(p => p.id === id));
    if (requestedProjectId) {
      return requestedProjectId;
    }
    const sorted = orderBy(
      writableProjects,
      ['isMember', 'isBookmarked'],
      ['desc', 'desc']
    );
    return sorted[0]?.id ?? '';
  }, [draftFormData, location.query.project, organization, projects]);

  const formSubmitHandler = useCreateDetectorFormSubmit({
    detectorType,
    formDataToEndpointPayload,
  });

  const {onFieldChange: validateEagerly} = useFormEagerValidation(formModel);

  const initialEnvironment = decodeScalar(location.query.environment, '');
  const initialData = useMemo(() => {
    // Only keep the draft's project if it passed the write-access check above.
    const draftProjectId =
      draftFormData?.projectId === initialProjectId ? initialProjectId : undefined;
    return {
      projectId: initialProjectId,
      environment: initialEnvironment,
      name: '',
      owner: '',
      workflowIds: [],
      ...initialFormData,
      ...omitBy(
        {...draftFormData, projectId: draftProjectId},
        value => value === undefined
      ),
    };
  }, [initialProjectId, initialEnvironment, initialFormData, draftFormData]);

  const formProps: FormProps = {
    model: formModel,
    initialData,
    onSubmit: formSubmitHandler,
    onFieldChange: id => {
      validateEagerly();
      syncDraftToUrl(id);
    },
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
