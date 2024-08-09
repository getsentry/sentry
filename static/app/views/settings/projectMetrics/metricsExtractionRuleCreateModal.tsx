import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  type ModalOptions,
  type ModalRenderProps,
  openModal,
} from 'sentry/actionCreators/modal';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsExtractionRule} from 'sentry/types/metrics';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCardinalityLimitedMetricVolume} from 'sentry/utils/metrics/useCardinalityLimitedMetricVolume';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {
  createCondition,
  explodeAggregateGroup,
  type FormData,
  MetricsExtractionRuleForm,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';
import {useCreateMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';

interface Props {
  organization: Organization;
  /**
   * Source parameter for analytics
   */
  source: string;
  /**
   * Initial data to populate the form with
   */
  initialData?: Partial<FormData>;
  /**
   * Callback when the form is submitted successfully
   */
  onSubmitSuccess?: (data: FormData) => void;
  /**
   * The project to create the metric for
   * If not provided, the user will be prompted to select a project
   */
  projectId?: string | number;
}

export const INITIAL_DATA: FormData = {
  spanAttribute: null,
  unit: 'none',
  aggregates: ['count'],
  tags: ['release', 'environment'],
  conditions: [createCondition()],
};

export function MetricsExtractionRuleCreateModal({
  Header,
  Body,
  closeModal,
  CloseButton,
  initialData: initalDataProp = {},
  projectId: projectIdProp,
  onSubmitSuccess,
}: Props & ModalRenderProps) {
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const initialData = useMemo(() => {
    return {
      ...INITIAL_DATA,
      ...initalDataProp,
    };
  }, [initalDataProp]);

  const initialProjectId = useMemo(() => {
    if (projectIdProp) {
      return projectIdProp;
    }

    if (selection.projects.length === 1 && selection.projects[0] !== -1) {
      return projects.find(p => p.id === String(selection.projects[0]))?.id;
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [projectId, setProjectId] = useState<string | number | undefined>(
    initialProjectId
  );

  const projectOptions = useMemo(() => {
    const nonMemberProjects: Project[] = [];
    const memberProjects: Project[] = [];
    projects
      .filter(
        project =>
          selection.projects.length === 0 ||
          selection.projects.includes(parseInt(project.id, 10))
      )
      .forEach(project =>
        project.isMember ? memberProjects.push(project) : nonMemberProjects.push(project)
      );

    return [
      {
        label: t('My Projects'),
        options: memberProjects.map(p => ({
          value: p.id,
          label: p.slug,
          leadingItems: <ProjectBadge project={p} avatarSize={16} hideName disableLink />,
        })),
      },
      {
        label: t('All Projects'),
        options: nonMemberProjects.map(p => ({
          value: p.id,
          label: p.slug,
          leadingItems: <ProjectBadge project={p} avatarSize={16} hideName disableLink />,
        })),
      },
    ];
  }, [selection.projects, projects]);

  return (
    <Fragment>
      <Header>
        <h4>{t('Create Metric')}</h4>
      </Header>
      <CloseButton />
      <Body>
        <p>
          {t(
            "Set up the metric you'd like to track and we'll collect it for you from future data."
          )}
        </p>
        {initialProjectId === undefined ? (
          <ProjectSelectionWrapper>
            <label htmlFor="project-select">{t('Project')}</label>
            <SelectControl
              id="project-select"
              placeholder={t('Select a project')}
              options={projectOptions}
              value={projectId}
              onChange={({value}) => setProjectId(value)}
              stacked={false}
            />
          </ProjectSelectionWrapper>
        ) : null}
        {projectId ? (
          <FormWrapper
            initialData={initialData}
            projectId={projectId}
            closeModal={closeModal}
            onSubmitSuccess={onSubmitSuccess}
          />
        ) : null}
      </Body>
    </Fragment>
  );
}

function FormWrapper({
  closeModal,
  projectId,
  initialData,
  onSubmitSuccess: onSubmitSuccessProp,
}: {
  closeModal: () => void;
  initialData: FormData;
  projectId: string | number;
  onSubmitSuccess?: (data: FormData) => void;
}) {
  const organization = useOrganization();
  const createExtractionRuleMutation = useCreateMetricsExtractionRules(
    organization.slug,
    projectId
  );

  const {data: cardinality} = useCardinalityLimitedMetricVolume({
    projects: [projectId],
  });

  const handleSubmit = useCallback(
    (
      data: FormData,
      onSubmitSuccess: (data: FormData) => void,
      onSubmitError: (error: any) => void
    ) => {
      const extractionRule: MetricsExtractionRule = {
        spanAttribute: data.spanAttribute!,
        tags: data.tags,
        aggregates: data.aggregates.flatMap(explodeAggregateGroup),
        unit: data.unit,
        conditions: data.conditions,
        projectId: Number(projectId),
        // Will be set by the backend
        createdById: null,
        dateAdded: '',
        dateUpdated: '',
      };

      createExtractionRuleMutation.mutate(
        {
          metricsExtractionRules: [extractionRule],
        },
        {
          onSuccess: () => {
            onSubmitSuccessProp?.(data);
            onSubmitSuccess(data);
            addSuccessMessage(t('Metric extraction rule created'));
            closeModal();
          },
          onError: error => {
            const message = error?.responseJSON?.detail
              ? (error.responseJSON.detail as string)
              : t('Unable to save your changes.');
            onSubmitError(message);
            addErrorMessage(message);
          },
        }
      );
      onSubmitSuccess(data);
    },
    [projectId, createExtractionRuleMutation, onSubmitSuccessProp, closeModal]
  );

  return (
    <MetricsExtractionRuleForm
      initialData={initialData}
      projectId={projectId}
      submitLabel={t('Add Metric')}
      cancelLabel={t('Cancel')}
      onCancel={closeModal}
      onSubmit={handleSubmit}
      cardinality={cardinality}
      submitDisabled={createExtractionRuleMutation.isLoading}
    />
  );
}

const ProjectSelectionWrapper = styled('div')`
  padding-bottom: ${space(2)};

  & > label {
    color: ${p => p.theme.gray300};
  }
`;

export const modalCss = css`
  width: 100%;
  max-width: 900px;
`;

export function openExtractionRuleCreateModal(props: Props, options?: ModalOptions) {
  const {organization, source, onSubmitSuccess} = props;

  trackAnalytics('ddm.span-metric.create.open', {
    organization,
    source,
  });

  const handleClose: ModalOptions['onClose'] = reason => {
    if (reason && ['close-button', 'backdrop-click', 'escape-key'].includes(reason)) {
      trackAnalytics('ddm.span-metric.create.cancel', {organization});
    }
    options?.onClose?.(reason);
  };

  const handleSubmitSuccess: Props['onSubmitSuccess'] = data => {
    trackAnalytics('ddm.span-metric.create.success', {
      organization,
      hasFilters: data.conditions.some(condition => condition.value),
    });
    onSubmitSuccess?.(data);
  };

  openModal(
    modalProps => (
      <MetricsExtractionRuleCreateModal
        {...props}
        onSubmitSuccess={handleSubmitSuccess}
        {...modalProps}
      />
    ),
    {
      modalCss,
      ...options,
      onClose: handleClose,
    }
  );
}
