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
  onApply: (threshold, metric) => void;
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
    const {projects, eventView} = this.props;
    const projectId = String(eventView.project[0]);
    const project = projects.find(proj => proj.id === projectId);

    return project;
  }

  handleApply = async (event: React.FormEvent) => {
    event.preventDefault();

    const {api, closeModal, organization, transactionName} = this.props;

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
        this.props.onApply(this.state.threshold, this.state.metric);
      })
      .catch(err => {
        this.setState({
          error: err,
        });
        const errorMessage = err.responseJSON?.threshold ?? null;
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

    const {api, closeModal, organization, transactionName} = this.props;

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
        closeModal();
        this.props.onApply(this.state.threshold, this.state.metric);
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
          />
        </Field>
      </React.Fragment>
    );
  }

  render() {
    const {Header, Body, Footer, organization} = this.props;

    const project = this.getProject();

    return (
      <React.Fragment>
        <Header closeButton>
          <h4>{t('Transaction Settings')}</h4>
        </Header>
        <Body>
          <Instruction>
            {tct(
              'The changes below will only be applied to this Transaction. To set it at a more global level, go to [projectSettings: Project Settings].',
              {
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
