import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import cloneDeep from 'lodash/cloneDeep';
import set from 'lodash/set';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import { ModalRenderProps } from 'app/actionCreators/modal';
import { Link } from 'react-router';
import EventView from 'app/utils/discover/eventView';
import { defined } from 'app/utils';
import Input from 'app/views/settings/components/forms/controls/input';
import Field from 'app/views/settings/components/forms/field';
import SelectControl from 'app/components/forms/selectControl';
import LoadingIndicator from 'app/components/loadingIndicator';
import withApi from 'app/utils/withApi';
import { Client } from 'app/api';
import withProjects from 'app/utils/withProjects';


export const METRIC_CHOICES = [
  {label: t('Transaction Duration'), value: 'duration'},
  {label: t('Largest Contentful Paint'), value: 'lcp'},
];

type Props = {
  api: Client;
  organization: Organization;
  transactionName: string;
  onApply: () => void;
  projects: Project[];
  eventView: EventView;
} & ModalRenderProps;

type State = {
  value: number | undefined;
  metric: string | undefined;
  error: string | null;
  isLoading: boolean;
};

class TransactionThresholdModal extends React.Component<Props, State> {

  state: State = {
    value: undefined,
    metric: undefined,
    error: null,
    isLoading: true,
  };

  getProject() {
    const {projects, eventView} = this.props
    const projectId = String(eventView.project[0]);
    const project = projects.find(proj => proj.id === projectId);

    return project
  }

  componentDidMount() {
    this.fetchData()
  }

  fetchData = () => {
    const {api, organization, transactionName} = this.props;

    const project = this.getProject()
    if (!defined(project)) {
      return;
    }
    const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;

    this.setState({isLoading: true});

    api
      .requestPromise(transactionThresholdUrl, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: project.id,
          transaction: transactionName,
        },
      })
      .then(([data]) => {
        this.setState({
          isLoading: false,
          error: null,
          value: data['threshold'],
          metric: data['metric'],
        });
      })
      .catch(err => {
        console.log(err)
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
              isLoading: false,
              error: null,
              value: data['threshold'],
              metric: data['metric'],
            });
          })
          .catch(err => {
            this.setState({
              isLoading: false,
              error: err,
            });
          })
      });
  };

  renderLoading() {
    return <LoadingIndicator />;
  }

  handleApply = async (event: React.FormEvent) => {
    event.preventDefault();

    const {
      api,
      closeModal,
      organization,
      transactionName,
    } = this.props;

    const project = this.getProject()
    if (!defined(project)) {
      return;
    }

    this.setState({isLoading: true});
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
          threshold: this.state.value,
          metric: this.state.metric,
        },
      })
      .then(() => {
        this.setState({isLoading: false});
        closeModal();
      })
      .catch(err => {
        this.setState({error: err})
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

    const {
      api,
      organization,
      transactionName,
    } = this.props;

    const project = this.getProject()
    if (!defined(project)) {
      return;
    }

    this.setState({isLoading: true});
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
        this.fetchData()
      })
      .catch(err => {
        this.setState({error: err, isLoading: false})
      });
  };

  renderModalFields() {
    return (
      <React.Fragment>
      <Field
        data-test-id="response-metric"
        label={t('Calculation Method')}
        inline={false}
        help={t('This determines which duration metric is used for the Response Time Threshold.')}
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
        help={t('The satisfactory response time for the calculation method defined above. This is used to calculate Apdex and User Misery scores.')}
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
            this.handleFieldChange('value')(event.target.value);
          }}
          value={this.state.value}
        />
      </Field>
      </React.Fragment>
    )
  }

  render() {
    const {
      Header,
      Body,
      Footer,
      organization,
    } = this.props

    const project = this.getProject()

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
                    <Link to={`/settings/${organization.slug}/projects/${project?.slug}/performance/`}/>
                  ),
                }
              )}
          </Instruction>
          {this.state.isLoading ? this.renderLoading() : this.renderModalFields()}
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button priority='default' onClick={this.handleReset} data-test-id="reset-all">
              {t('Reset All')}
            </Button>
            <Button label={t('Apply')} priority="primary" onClick={this.handleApply} data-test-id="apply-threshold">
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
