import {Fragment, useCallback, useMemo} from 'react';
import {css} from '@emotion/react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {MetricsExtractionRule} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {
  aggregatesToGroups,
  createCondition as createExtractionCondition,
  explodeAggregateGroup,
  type FormData,
  MetricsExtractionRuleForm,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';
import {useUpdateMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/api';

interface Props extends ModalRenderProps {
  metricExtractionRule: MetricsExtractionRule;
  project: Project;
}

export function MetricsExtractionRuleEditModal({
  Header,
  Body,
  closeModal,
  CloseButton,
  metricExtractionRule,
  project,
}: Props) {
  const organization = useOrganization();
  const updateExtractionRuleMutation = useUpdateMetricsExtractionRules(
    organization.slug,
    project.slug
  );

  const initialData: FormData = useMemo(() => {
    return {
      spanAttribute: metricExtractionRule.spanAttribute,
      aggregates: aggregatesToGroups(metricExtractionRule.aggregates),
      tags: metricExtractionRule.tags,
      conditions: metricExtractionRule.conditions.length
        ? metricExtractionRule.conditions
        : [createExtractionCondition()],
    };
  }, [metricExtractionRule]);

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
        unit: 'none',
        conditions: data.conditions,
        projectId: parseInt(project.id, 10),
      };

      updateExtractionRuleMutation.mutate(
        {
          metricsExtractionRules: [extractionRule],
        },
        {
          onSuccess: () => {
            onSubmitSuccess(data);
            addSuccessMessage(t('Metric extraction rule updated'));
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
    [closeModal, project.id, updateExtractionRuleMutation]
  );

  return (
    <Fragment>
      <Header>
        <h4>{metricExtractionRule.spanAttribute}</h4>
      </Header>
      <CloseButton />
      <Body>
        <MetricsExtractionRuleForm
          initialData={initialData}
          project={project}
          submitLabel={t('Update')}
          cancelLabel={t('Cancel')}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          isEdit
          requireChanges
        />
      </Body>
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1000px;
`;
