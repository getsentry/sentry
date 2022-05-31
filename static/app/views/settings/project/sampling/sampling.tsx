import {Fragment} from 'react';
import {Location} from 'history';
import partition from 'lodash/partition';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {Panel, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {
  SamplingConditionOperator,
  SamplingRule,
  SamplingRules,
  SamplingRuleType,
} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import recreateRoute from 'sentry/utils/recreateRoute';
import withProject from 'sentry/utils/withProject';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import {modalCss} from './modal/utils';
import Modal from './modal';
import {RulesPanel} from './rulesPanel';
import {SAMPLING_DOC_LINK} from './utils';

type Props = AsyncView['props'] & {
  hasAccess: boolean;
  location: Location;
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  projectDetails: Project | null;
  rules: SamplingRules;
};

class Sampling extends AsyncView<Props, State> {
  getTitle() {
    return t('Sampling');
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      rules: [],
      projectDetails: null,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [['projectDetails', `/projects/${organization.slug}/${project.slug}/`]];
  }

  componentDidMount() {
    const {organization, project} = this.props;

    trackAdvancedAnalyticsEvent('sampling.settings.view', {
      organization,
      project_id: project.id,
    });

    this.getRules();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.projectDetails !== this.state.projectDetails) {
      this.getRules();
      return;
    }
  }

  getRules() {
    const {projectDetails} = this.state;

    if (!projectDetails) {
      return;
    }

    const {dynamicSampling} = projectDetails;
    const rules = dynamicSampling?.rules ?? [];

    const transactionRules = rules.filter(
      rule =>
        rule.type === SamplingRuleType.TRANSACTION || rule.type === SamplingRuleType.TRACE
    );

    const [rulesWithoutConditions, rulesWithConditions] = partition(
      transactionRules,
      transactionRule => !transactionRule.condition.inner.length
    );

    this.setState({rules: [...rulesWithConditions, ...rulesWithoutConditions]});
  }

  successfullySubmitted = (projectDetails: Project, successMessage?: React.ReactNode) => {
    this.setState({projectDetails});

    if (successMessage) {
      addSuccessMessage(successMessage);
    }
  };

  handleOpenRule = (rule?: SamplingRule) => () => {
    const {organization, project, hasAccess} = this.props;
    const {rules} = this.state;

    return openModal(
      modalProps => (
        <Modal
          {...modalProps}
          api={this.api}
          organization={organization}
          project={project}
          rule={rule}
          rules={rules}
          onSubmitSuccess={this.successfullySubmitted}
          disabled={!hasAccess}
        />
      ),
      {
        modalCss,
      }
    );
  };

  handleDeleteRule = (rule: SamplingRule) => () => {
    const {organization, project} = this.props;
    const {rules} = this.state;

    const conditions = rule.condition.inner.map(({name}) => name);

    trackAdvancedAnalyticsEvent('sampling.settings.rule.delete', {
      organization,
      project_id: project.id,
      sampling_rate: rule.sampleRate * 100,
      conditions,
      conditions_stringified: conditions.sort().join(', '),
    });

    const newRules = rules.filter(({id}) => id !== rule.id);

    this.submitRules(
      newRules,
      t('Successfully deleted sampling rule'),
      t('An error occurred while deleting sampling rule')
    );
  };

  handleUpdateRules = (rules: Array<SamplingRule>) => {
    if (!rules.length) {
      return;
    }

    this.submitRules(rules);
  };

  async submitRules(
    newRules: SamplingRules,
    successMessage?: string,
    errorMessage?: string
  ) {
    const {organization, project} = this.props;

    try {
      const projectDetails = await this.api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/`,
        {method: 'PUT', data: {dynamicSampling: {rules: newRules}}}
      );
      this.successfullySubmitted(projectDetails, successMessage);
    } catch (error) {
      this.getRules();
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
    }
  }

  renderBody() {
    const {rules} = this.state;
    const {hasAccess, location} = this.props;
    const disabled = !hasAccess;

    const hasNotSupportedConditionOperator = rules.some(
      rule => rule.condition.op !== SamplingConditionOperator.AND
    );

    return (
      <Fragment>
        <SettingsPageHeader
          title={this.getTitle()}
          tabs={
            <NavTabs underlined>
              <ListLink
                to={`${location.pathname}/#distributed-traces/`}
                index
                isActive={() => true}
                onClick={() => {}}
              >
                {t('Distributed Traces')}
              </ListLink>
              {/* <ListLink
                to={`${baseUrl}/#distributed-traces/`}
                index
                isActive={() => true}
                onClick={() => {}}
              >
                {t('Distributed Traces')}
              </ListLink>
              <ListLink
                to={`${baseUrl}/#individual-transactions/`}
                isActive={() => false}
                onClick={() => {}}
              >
                {t('Individual Transactions')}
              </ListLink> */}
            </NavTabs>
          }
        />
        <PermissionAlert />
        {hasNotSupportedConditionOperator ? (
          <Alert type="error">
            {t('A condition operator has been found that is not yet supported.')}
          </Alert>
        ) : (
          <RulesPanel
            rules={rules}
            disabled={disabled}
            onAddRule={this.handleOpenRule()}
            onEditRule={this.handleOpenRule}
            onDeleteRule={this.handleDeleteRule}
            onUpdateRules={this.handleUpdateRules}
          />
        )}
      </Fragment>
    );
  }
}

const SamplingWithProject = withProject(Sampling);

export {SamplingWithProject as Sampling};
