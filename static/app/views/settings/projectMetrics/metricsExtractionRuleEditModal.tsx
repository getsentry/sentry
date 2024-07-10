import {Fragment, useCallback, useMemo} from 'react';
import {css} from '@emotion/react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  type ModalOptions,
  type ModalRenderProps,
  openModal,
} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {MetricsExtractionRule} from 'sentry/types/metrics';
import {useMetricsCardinality} from 'sentry/utils/metrics/useMetricsCardinality';
import useOrganization from 'sentry/utils/useOrganization';
import {
  aggregatesToGroups,
  createCondition as createExtractionCondition,
  explodeAggregateGroup,
  type FormData,
  MetricsExtractionRuleForm,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';
import {useUpdateMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';

interface Props {
  metricExtractionRule: MetricsExtractionRule;
}

export function MetricsExtractionRuleEditModal({
  Header,
  Body,
  closeModal,
  CloseButton,
  metricExtractionRule,
}: Props & ModalRenderProps) {
  const organization = useOrganization();
  const updateExtractionRuleMutation = useUpdateMetricsExtractionRules(
    organization.slug,
    metricExtractionRule.projectId
  );

  const {data: cardinality} = useMetricsCardinality({
    projects: [metricExtractionRule.projectId],
  });

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
        projectId: metricExtractionRule.projectId,
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
    [closeModal, metricExtractionRule.projectId, updateExtractionRuleMutation]
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
          projectId={metricExtractionRule.projectId}
          submitLabel={t('Update')}
          cancelLabel={t('Cancel')}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          cardinality={cardinality}
          isEdit
          requireChanges
        />
      </Body>
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 900px;
`;

export function openExtractionRuleEditModal(props: Props, options?: ModalOptions) {
  openModal(modalProps => <MetricsExtractionRuleEditModal {...props} {...modalProps} />, {
    modalCss,
    ...options,
  });
}
