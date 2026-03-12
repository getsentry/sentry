import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {FieldGroup} from 'sentry/components/forms/fieldGroup';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type EventView from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';
import {withProjects} from 'sentry/utils/withProjects';

import {useEventViewProject} from './useEventViewProject';
import {transactionSummaryRouteWithQuery} from './utils';

export enum TransactionThresholdMetric {
  TRANSACTION_DURATION = 'duration',
  LARGEST_CONTENTFUL_PAINT = 'lcp',
}

const METRIC_CHOICES = [
  {label: t('Transaction Duration'), value: 'duration'},
  {label: t('Largest Contentful Paint'), value: 'lcp'},
];

type Props = {
  api: Client;
  eventView: EventView;
  organization: Organization;
  projects: Project[];
  transactionName: string;
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
  onApply?: (threshold: any, metric: any) => void;
  project?: string;
} & ModalRenderProps;

function TransactionThresholdModal({
  api,
  Body,
  eventView,
  Footer,
  Header,
  organization,
  closeModal,
  onApply,
  project: projectId,
  projects,
  transactionName,
  transactionThreshold,
  transactionThresholdMetric,
}: Props) {
  const [threshold, setThreshold] = useState<number | string | undefined>(
    transactionThreshold
  );
  const [metric, setMetric] = useState<TransactionThresholdMetric | undefined>(
    transactionThresholdMetric
  );
  const project = useEventViewProject(projects, eventView, projectId);

  const handleApply = (event: React.FormEvent) => {
    event.preventDefault();

    if (!defined(project)) {
      return;
    }

    const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;

    api
      .requestPromise(transactionThresholdUrl, {
        method: 'POST',
        includeAllArgs: true,
        query: {
          project: project.id,
        },
        data: {
          transaction: transactionName,
          threshold,
          metric,
        },
      })
      .then(() => {
        closeModal();
        if (onApply) {
          onApply(threshold, metric);
        }
      })
      .catch(err => {
        let errorMessage =
          err.responseJSON?.threshold ?? err.responseJSON?.non_field_errors ?? null;
        if (Array.isArray(errorMessage)) {
          errorMessage = errorMessage[0];
        }
        addErrorMessage(errorMessage);
      });
  };

  const handleReset = (event: React.FormEvent) => {
    event.preventDefault();

    if (!defined(project)) {
      return;
    }

    const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;

    api
      .requestPromise(transactionThresholdUrl, {
        method: 'DELETE',
        includeAllArgs: true,
        query: {
          project: project.id,
        },
        data: {
          transaction: transactionName,
        },
      })
      .then(() => {
        const projectThresholdUrl = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
        return api
          .requestPromise(projectThresholdUrl, {
            method: 'GET',
            includeAllArgs: true,
            query: {
              project: project.id,
            },
          })
          .then(([data]) => {
            setThreshold(data.threshold);
            setMetric(data.metric);
            closeModal();
            if (onApply) {
              onApply(data.threshold, data.metric);
            }
          });
      })
      .catch(err => {
        const errorMessage = err.responseJSON?.threshold ?? null;
        addErrorMessage(errorMessage);
      });
  };

  function renderModalFields() {
    return (
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
            required
            options={METRIC_CHOICES.slice()}
            name="responseMetric"
            label={t('Calculation Method')}
            value={metric}
            onChange={(option: {value: TransactionThresholdMetric}) => {
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
  }

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
        {renderModalFields()}
      </Body>
      <Footer>
        <Grid flow="column" align="center" gap="md">
          <Button priority="default" onClick={handleReset} data-test-id="reset-all">
            {t('Reset All')}
          </Button>
          <Button
            aria-label={t('Apply')}
            priority="primary"
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

export default withApi(withProjects(TransactionThresholdModal));
