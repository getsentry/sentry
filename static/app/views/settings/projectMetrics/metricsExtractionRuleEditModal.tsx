import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type FormData,
  MetricsExtractionRuleForm,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';
import {
  type MetricsExtractionRule,
  useUpdateMetricsExtractionRules,
} from 'sentry/views/settings/projectMetrics/utils/api';

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

  function handleSubmit(
    data: FormData,
    onSubmitSuccess: (data: FormData) => void,
    onSubmitError: (error: any) => void
  ) {
    const extractionRule: MetricsExtractionRule = {
      spanAttribute: data.spanAttribute!,
      tags: data.tags,
      type: data.type!,
      unit: 'none',
      conditions: data.conditions.filter(Boolean),
    };

    updateExtractionRuleMutation.mutate(
      {
        metricsExtractionRules: [extractionRule],
      },
      {
        onSuccess: () => {
          onSubmitSuccess(data);
          closeModal();
        },
        onError: error => {
          onSubmitError(
            error?.responseJSON?.detail
              ? error.responseJSON.detail
              : t('Unable to save your changes.')
          );
        },
      }
    );
    onSubmitSuccess(data);
  }

  return (
    <Fragment>
      <Header>
        <h4>
          <Capitalize>{getReadableMetricType(metricExtractionRule.type)}</Capitalize>
          {' — '}
          {metricExtractionRule.spanAttribute}
        </h4>
      </Header>
      <CloseButton />
      <Body>
        <MetricsExtractionRuleForm
          initialData={metricExtractionRule}
          project={project}
          submitLabel={t('Update')}
          cancelLabel={t('Cancel')}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          isEdit
        />
      </Body>
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1000px;
`;

const Capitalize = styled('span')`
  text-transform: capitalize;
`;
