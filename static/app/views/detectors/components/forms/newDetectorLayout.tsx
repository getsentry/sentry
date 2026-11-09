import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import omitBy from 'lodash/omitBy';
import orderBy from 'lodash/orderBy';
import {useQueryStates} from 'nuqs';

import type {FormProps} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';
import type {Data} from 'sentry/components/forms/types';
import {useFormEagerValidation} from 'sentry/components/forms/useFormEagerValidation';
import {EditLayoutDeprecated} from 'sentry/components/workflowEngine/layout/edit';
import type {
  BaseDetectorUpdatePayload,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useCreateDetectorFormSubmit} from 'sentry/views/detectors/hooks/useCreateDetectorFormSubmit';
import {hasDetectorWriteAccess} from 'sentry/views/detectors/utils/permissions';

import {DetectorFormBreadcrumbs} from './common/breadcrumbs';
import {useDetectorDraft, type DetectorDraftSchema} from './common/detectorDraft';
import {NewDetectorFooter} from './common/footer';

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
  const [{project: urlProjectIds, environment: urlEnvironments}] =
    useQueryStates(pageFilterParsers);
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
    const requestedProjectId = [draftFormData?.projectId, urlProjectIds[0]].find(id =>
      writableProjects.some(p => p.id === id)
    );
    if (requestedProjectId) {
      return requestedProjectId;
    }
    const sorted = orderBy(
      writableProjects,
      ['isMember', 'isBookmarked'],
      ['desc', 'desc']
    );
    return sorted[0]?.id ?? '';
  }, [draftFormData, urlProjectIds, organization, projects]);

  const formSubmitHandler = useCreateDetectorFormSubmit({
    detectorType,
    formDataToEndpointPayload,
  });

  const {onFieldChange: validateEagerly} = useFormEagerValidation(formModel);

  const initialEnvironment = urlEnvironments[0] ?? '';
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
