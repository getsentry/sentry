import {Component} from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {openModal} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconSettings} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {defined} from 'app/utils';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

import TransactionThresholdModal, {
  modalCss,
  TransactionThresholdMetric,
} from './transactionThresholdModal';

type Props = {
  api: Client;
  organization: Organization;
  transactionName: string;
  projects: Project[];
  eventView: EventView;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
};

type State = {
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
  loadingThreshold: boolean;
};

class TransactionThresholdButton extends Component<Props, State> {
  state: State = {
    transactionThreshold: undefined,
    transactionThresholdMetric: undefined,
    loadingThreshold: false,
  };

  componentDidMount() {
    this.fetchTransactionThreshold();
  }

  getProject() {
    const {projects, eventView} = this.props;
    if (!defined(eventView)) {
      return undefined;
    }

    const projectId = String(eventView.project[0]);
    const project = projects.find(proj => proj.id === projectId);

    return project;
  }

  fetchTransactionThreshold = () => {
    const {api, organization, transactionName} = this.props;

    const project = this.getProject();
    if (!defined(project)) {
      return;
    }
    const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;

    this.setState({loadingThreshold: true});

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
          loadingThreshold: false,
          transactionThreshold: data.threshold,
          transactionThresholdMetric: data.metric,
        });
      })
      .catch(() => {
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
              loadingThreshold: false,
              transactionThreshold: data.threshold,
              transactionThresholdMetric: data.metric,
            });
          })
          .catch(err => {
            this.setState({loadingThreshold: false});
            const errorMessage = err.responseJSON?.threshold ?? null;
            addErrorMessage(errorMessage);
          });
      });
  };

  onChangeThreshold(threshold: number, metric: TransactionThresholdMetric) {
    const {onChangeThreshold} = this.props;
    this.setState({
      transactionThreshold: threshold,
      transactionThresholdMetric: metric,
    });

    if (defined(onChangeThreshold)) {
      onChangeThreshold(threshold, metric);
    }
  }

  openModal() {
    const {organization, transactionName, eventView} = this.props;

    const {transactionThreshold, transactionThresholdMetric} = this.state;

    openModal(
      modalProps => (
        <TransactionThresholdModal
          {...modalProps}
          organization={organization}
          transactionName={transactionName}
          eventView={eventView}
          transactionThreshold={transactionThreshold}
          transactionThresholdMetric={transactionThresholdMetric}
          onApply={(threshold, metric) => this.onChangeThreshold(threshold, metric)}
        />
      ),
      {modalCss, backdrop: 'static'}
    );
  }

  render() {
    const {loadingThreshold} = this.state;
    return (
      <Button
        onClick={() => this.openModal()}
        icon={<IconSettings />}
        disabled={loadingThreshold}
        aria-label={t('Settings')}
        data-test-id="set-transaction-threshold"
      />
    );
  }
}

export default withApi(withProjects(TransactionThresholdButton));
