import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {defined} from 'sentry/utils/defined';
import type {EventView} from 'sentry/utils/discover/eventView';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useProjects} from 'sentry/utils/useProjects';

import {projectTransactionThresholdApiOptions} from './transactionThresholdApiOptions';
import {useEventViewProject} from './useEventViewProject';
import {transactionSummaryRouteWithQuery} from './utils';

export enum TransactionThresholdMetric {
  TRANSACTION_DURATION = 'duration',
  LARGEST_CONTENTFUL_PAINT = 'lcp',
}

type Props = {
  eventView: EventView;
  organization: Organization;
  transactionName: string;
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
  onApply?: (threshold: any, metric: any) => void;
  project?: string;
} & ModalRenderProps;

export function TransactionThresholdModal({
  Body,
  eventView,
  Footer,
  Header,
  organization,
  closeModal,
  onApply,
  project: projectId,
  transactionName,
  transactionThreshold,
  transactionThresholdMetric,
}: Props) {
  const [threshold, setThreshold] = useState<number | string | undefined>(
    transactionThreshold
  );
  const [metric, setMetric] = useState(transactionThresholdMetric);
  const {projects} = useProjects();
  const project = useEventViewProject(projects, eventView, projectId);

  const queryClient = useQueryClient();
  const overrideUrl = getApiUrl(
    '/organizations/$organizationIdOrSlug/project-transaction-threshold-override/',
    {path: {organizationIdOrSlug: organization.slug}}
  );

  const {mutate: applyThreshold} = useMutation({
    mutationFn: (variables: {
      metric: TransactionThresholdMetric | undefined;
      project: Project;
      threshold: number | string | undefined;
    }) =>
      fetchMutation({
        url: overrideUrl,
        method: 'POST',
        options: {query: {project: variables.project.id}},
        data: {
          transaction: transactionName,
          threshold: variables.threshold,
          metric: variables.metric,
        },
      }),
    onSuccess: (_data, variables) => {
      closeModal();
      onApply?.(variables.threshold, variables.metric);
    },
    onError: err => {
      let errorMessage =
        err instanceof RequestError
          ? (err.responseJSON?.threshold ?? err.responseJSON?.non_field_errors)
          : null;
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage[0];
      }
      addErrorMessage(errorMessage as string);
    },
  });

  const {mutate: resetThreshold} = useMutation({
    mutationFn: async (resetProject: Project) => {
      await fetchMutation({
        url: overrideUrl,
        method: 'DELETE',
        options: {query: {project: resetProject.id}},
        data: {transaction: transactionName},
      });
      const response = await queryClient.fetchQuery(
        projectTransactionThresholdApiOptions({organization, project: resetProject})
      );
      return response.json;
    },
    onSuccess: data => {
      setThreshold(data.threshold);
      setMetric(data.metric);
      closeModal();
      onApply?.(data.threshold, data.metric);
    },
    onError: err => {
      const errorMessage =
        err instanceof RequestError ? err.responseJSON?.threshold : null;
      addErrorMessage(errorMessage as string);
    },
  });

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();

    if (!defined(project)) {
      return;
    }

    applyThreshold({project, threshold, metric});
  };

  const handleReset = (event: React.FormEvent) => {
    event.preventDefault();

    if (!defined(project)) {
      return;
    }

    resetThreshold(project);
  };

  const modalFields = (
    <Fragment>
      <FieldGroup
        data-test-id="response-metric"
        label={t('Calculation Method')}
        inline={false}
        help={t(
          'This determines which duration metric is used for the Response Time Threshold.'
        )}
        showHelpInTooltip
        flexibleControlStateSize
        stacked
        required
      >
        <Select
          options={[
            {
              label: t('Transaction Duration'),
              value: TransactionThresholdMetric.TRANSACTION_DURATION,
            },
            {
              label: t('Largest Contentful Paint'),
              value: TransactionThresholdMetric.LARGEST_CONTENTFUL_PAINT,
            },
          ]}
          name="responseMetric"
          value={metric ?? null}
          onChange={option => {
            setMetric(option.value);
          }}
        />
      </FieldGroup>
      <FieldGroup
        data-test-id="response-time-threshold"
        label={t('Response Time Threshold (ms)')}
        inline={false}
        help={t(
          'The satisfactory response time for the calculation method defined above. This is used to calculate Apdex and User Misery scores.'
        )}
        showHelpInTooltip
        flexibleControlStateSize
        stacked
        required
      >
        <Input
          type="number"
          name="threshold"
          pattern="[0-9]*(\.[0-9]*)?"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setThreshold(event.target.value);
          }}
          value={threshold}
          step={100}
          min={100}
        />
      </FieldGroup>
    </Fragment>
  );

  const summaryView = eventView.clone();
  summaryView.query = summaryView.getQueryWithAdditionalConditions();
  const target = transactionSummaryRouteWithQuery({
    organization,
    transaction: transactionName,
    query: summaryView.generateQueryStringObject(),
    projectID: project?.id,
  });

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Transaction Settings')}</h4>
      </Header>
      <Body>
        <Instruction>
          {tct(
            'The changes below will only be applied to [transaction]. To set it at a more global level, go to [projectSettings: Project Settings].',
            {
              transaction: <Link to={target}>{transactionName}</Link>,
              projectSettings: (
                <Link
                  to={`/settings/${organization.slug}/projects/${project?.slug}/performance/`}
                />
              ),
            }
          )}
        </Instruction>
        {modalFields}
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button variant="secondary" onClick={handleReset} data-test-id="reset-all">
            {t('Reset All')}
          </Button>
          <Button
            aria-label={t('Apply')}
            variant="primary"
            onClick={handleApply}
            data-test-id="apply-threshold"
          >
            {t('Apply')}
          </Button>
        </Grid>
      </Footer>
    </Fragment>
  );
}

const Instruction = styled('div')`
  margin-bottom: ${p => p.theme.space['3xl']};
`;

export const modalCss = css`
  width: 100%;
  max-width: 650px;
`;
