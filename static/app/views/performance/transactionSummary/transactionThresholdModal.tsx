import * as React from 'react';
import {Link} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import FeatureBadge from 'app/components/featureBadge';
import SelectControl from 'app/components/forms/selectControl';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';

import {transactionSummaryRouteWithQuery} from './utils';

export enum TransactionThresholdMetric {
  TRANSACTION_DURATION = 'duration',
  LARGEST_CONTENTFUL_PAINT = 'lcp',
}

export const METRIC_CHOICES = [
  {label: t('Transaction Duration'), value: 'duration'},
  {label: t('Largest Contentful Paint'), value: 'lcp'},
];

type Props = {
  api: Client;
  organization: Organization;
  transactionName: string;
  onApply?: (threshold, metric) => void;
  project?: string;
  projects: Project[];
  eventView: EventView;
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
} & ModalRenderProps;

type State = {
  threshold: number | undefined;
  metric: TransactionThresholdMetric | undefined;
  error: string | null;
};

class TransactionThresholdModal extends React.Component<Props, State> {
  state: State = {
    threshold: this.props.transactionThreshold,
    metric: this.props.transactionThresholdMetric,
    error: null,
  };

  getProject() {
    const {projects, eventView, project} = this.props;

    if (defined(project)) {
      return projects.find(proj => proj.id === project);
    } else {
      const projectId = String(eventView.project[0]);
      return projects.find(proj => proj.id === projectId);
    }
  }

  handleApply = async (event: React.FormEvent) => {
    event.preventDefault();

    const {api, closeModal, organization, transactionName, onApply} = this.props;

    const project = this.getProject();
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
          threshold: this.state.threshold,
          metric: this.state.metric,
        },
      })
      .then(() => {
        closeModal();
        if (onApply) {
          onApply(this.state.threshold, this.state.metric);
        }
      })
      .catch(err => {
        this.setState({
          error: err,
        });
        const errorMessage =
          err.responseJSON?.threshold ?? err.responseJSON?.non_field_errors ?? null;
        addErrorMessage(errorMessage);
      });
  };

  handleFieldChange = (field: string) => (value: string) => {
    this.setState(prevState => {
      const newState = cloneDeep(prevState);
      set(newState, field, value);

      return {...newState, errors: undefined};
    });
  };

  handleReset = async (event: React.FormEvent) => {
    event.preventDefault();

    const {api, closeModal, organization, transactionName, onApply} = this.props;

    const project = this.getProject();
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
        this.props.api
          .requestPromise(projectThresholdUrl, {
            method: 'GET',
            includeAllArgs: true,
            query: {
              project: project.id,
            },
          })
          .then(([data]) => {
            this.setState({
              threshold: data.threshold,
              metric: data.metric,
            });
            closeModal();
            if (onApply) {
              onApply(this.state.threshold, this.state.metric);
            }
          })
          .catch(err => {
            const errorMessage = err.responseJSON?.threshold ?? null;
            addErrorMessage(errorMessage);
          });
      })
      .catch(err => {
        this.setState({
          error: err,
        });
      });
  };

  renderModalFields() {
    return (
      <React.Fragment>
        <Field
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
          <SelectControl
            required
            options={METRIC_CHOICES.slice()}
            name="responseMetric"
            label={t('Calculation Method')}
            value={this.state.metric}
            onChange={(option: {label: string; value: string}) => {
              this.handleFieldChange('metric')(option.value);
            }}
          />
        </Field>
        <Field
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
            required
            pattern="[0-9]*(\.[0-9]*)?"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              this.handleFieldChange('threshold')(event.target.value);
            }}
            value={this.state.threshold}
            step={100}
            min={100}
          />
        </Field>
      </React.Fragment>
    );
  }

  render() {
    const {Header, Body, Footer, organization, transactionName, eventView} = this.props;

    const project = this.getProject();

    const summaryView = eventView.clone();
    summaryView.query = summaryView.getQueryWithAdditionalConditions();
    const target = transactionSummaryRouteWithQuery({
      orgSlug: organization.slug,
      transaction: transactionName,
      query: summaryView.generateQueryStringObject(),
      projectID: project?.id,
    });

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>
            {t('Transaction Settings')} <FeatureBadge type="beta" />
          </h4>
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
          {this.renderModalFields()}
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              priority="default"
              onClick={this.handleReset}
              data-test-id="reset-all"
            >
              {t('Reset All')}
            </Button>
            <Button
              label={t('Apply')}
              priority="primary"
              onClick={this.handleApply}
              data-test-id="apply-threshold"
            >
              {t('Apply')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

const Instruction = styled('div')`
  margin-bottom: ${space(4)};
`;

export const modalCss = css`
  width: 100%;
  max-width: 650px;
  margin: 70px auto;
`;

export default withApi(withProjects(TransactionThresholdModal));
