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
  DetectorDraftUrlSync,
  useInitialDetectorDraft,
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
  /** Must be a stable reference. */
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

  const writableProjects = useMemo(
    () => projects.filter(project => hasDetectorWriteAccess({organization, project})),
    [organization, projects]
  );

  const initialProjectId = useMemo(() => {
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
  }, [location.query.project, writableProjects]);

  const draft = useInitialDetectorDraft();
  const [draftFormData] = useState(() => {
    if (!draftSchema || !draft) {
      return;
    }
    const values = draftSchema.parse(draft);
    if (
      values.projectId !== undefined &&
      !writableProjects.some(p => p.id === values.projectId)
    ) {
      delete values.projectId;
    }
    return values;
  });

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
      ...omitBy(draftFormData, value => value === undefined),
    };
  }, [initialProjectId, initialEnvironment, initialFormData, draftFormData]);

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

      {/* After the body, so fields setting their initial values don't count as edits. */}
      {draftSchema && <DetectorDraftUrlSync formModel={formModel} schema={draftSchema} />}

      <NewDetectorFooter
        maxWidth={maxWidth}
        disabledCreate={disabledCreate}
        extras={extraFooterButton}
      />
    </EditLayoutDeprecated>
  );
}
