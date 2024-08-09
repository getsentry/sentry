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
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCardinalityLimitedMetricVolume} from 'sentry/utils/metrics/useCardinalityLimitedMetricVolume';
import {
  aggregatesToGroups,
  createCondition as createExtractionCondition,
  explodeAggregateGroup,
  type FormData,
  MetricsExtractionRuleForm,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';
import {useUpdateMetricsExtractionRules} from 'sentry/views/settings/projectMetrics/utils/useMetricsExtractionRules';

interface Props {
  /**
   * The extraction rule to edit
   */
  metricExtractionRule: MetricsExtractionRule;
  organization: Organization;
  /**
   * Source parameter for analytics
   */
  source: string;
  /**
   * Callback when the form is submitted successfully
   */
  onSubmitSuccess?: (data: FormData) => void;
}

export function MetricsExtractionRuleEditModal({
  Header,
  Body,
  closeModal,
  CloseButton,
  metricExtractionRule,
  organization,
  onSubmitSuccess: onSubmitSuccessProp,
}: Props & ModalRenderProps) {
  const updateExtractionRuleMutation = useUpdateMetricsExtractionRules(
    organization.slug,
    metricExtractionRule.projectId
  );

  const {data: cardinality} = useCardinalityLimitedMetricVolume({
    projects: [metricExtractionRule.projectId],
  });

  const initialData: FormData = useMemo(() => {
    return {
      spanAttribute: metricExtractionRule.spanAttribute,
      unit: metricExtractionRule.unit,
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
        ...metricExtractionRule,
        spanAttribute: data.spanAttribute!,
        tags: data.tags,
        aggregates: data.aggregates.flatMap(explodeAggregateGroup),
        unit: data.unit,
        conditions: data.conditions,
      };

      updateExtractionRuleMutation.mutate(
        {
          metricsExtractionRules: [extractionRule],
        },
        {
          onSuccess: () => {
            onSubmitSuccess(data);
            onSubmitSuccessProp?.(data);
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
    [closeModal, metricExtractionRule, onSubmitSuccessProp, updateExtractionRuleMutation]
  );

  return (
    <Fragment>
      <Header>
        <h4>{t('Edit Metric')}</h4>
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
          submitDisabled={updateExtractionRuleMutation.isLoading}
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
  const {organization, metricExtractionRule, source, onSubmitSuccess} = props;

  trackAnalytics('ddm.span-metric.edit.open', {
    organization,
    hasFilters: metricExtractionRule.conditions.some(condition => condition.value),
    source,
  });

  const handleClose: ModalOptions['onClose'] = reason => {
    if (reason && ['close-button', 'backdrop-click', 'escape-key'].includes(reason)) {
      trackAnalytics('ddm.span-metric.edit.cancel', {organization});
    }
    options?.onClose?.(reason);
  };

  const handleSubmitSuccess: Props['onSubmitSuccess'] = data => {
    trackAnalytics('ddm.span-metric.edit.success', {
      organization,
      hasFilters: data.conditions.some(condition => condition.value),
    });
    onSubmitSuccess?.(data);
  };

  openModal(
    modalProps => (
      <MetricsExtractionRuleEditModal
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
