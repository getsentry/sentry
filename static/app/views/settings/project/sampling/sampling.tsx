import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import partition from 'lodash/partition';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Badge from 'sentry/components/badge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import {t, tct, tn} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {SamplingRule, SamplingRules, SamplingRuleType} from 'sentry/types/sampling';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import recreateRoute from 'sentry/utils/recreateRoute';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import TextBlock from '../../components/text/textBlock';

import {modalCss} from './modal/utils';
import {SamplingRuleModal} from './modal';
import {TraceRules} from './traceRules';
import {TransactionRules} from './transactionRules';
import {SAMPLING_DOC_LINK} from './utils';

type Props = AsyncView['props'] &
  RouteComponentProps<{ruleType: SamplingRuleType}, {}> & {
    hasAccess: boolean;
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

  handleOpenRule = (type: SamplingRuleType) => (ruleToUpdate?: SamplingRule) => () => {
    const {project, organization, hasAccess} = this.props;
    const {rules} = this.state;

    return openModal(
      modalProps => (
        <SamplingRuleModal
          {...modalProps}
          organization={organization}
          project={project}
          rule={ruleToUpdate}
          rules={rules.filter(rule => rule.type === type)}
          onSubmitSuccess={this.successfullySubmitted}
          disabled={!hasAccess}
          type={type}
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
    const {hasAccess, location, params, routes} = this.props;
    const disabled = !hasAccess;

    const [traceRules, transactionRules] = partition(
      rules,
      rule => rule.type === SamplingRuleType.TRACE
    );

    return (
      <Fragment>
        <SettingsPageHeader
          title={this.getTitle()}
          subtitle={
            <Fragment>
              <TextBlock>
                {tct(
                  'Here you can define what transactions count towards your quota without updating your SDK. Any rules specified here are applied after your [link:SDK sampling configuration]. New rules will propagate within a few minutes.',
                  {
                    link: <ExternalLink href={SAMPLING_DOC_LINK} />,
                  }
                )}
              </TextBlock>
              <PermissionAlert />
            </Fragment>
          }
          tabs={
            <NavTabs role="tablist" aria-label={t('Rules tabs')} underlined>
              <ListLink
                to={recreateRoute(`${SamplingRuleType.TRACE}/`, {
                  routes,
                  location,
                  params,
                  stepBack: -1,
                })}
                role="tab"
                aria-selected={params.ruleType === SamplingRuleType.TRACE}
                tabIndex={params.ruleType === SamplingRuleType.TRACE ? 0 : -1}
                isActive={() => params.ruleType === SamplingRuleType.TRACE}
                index
              >
                {t('Distributed Traces')}
                <Badge>{traceRules.length}</Badge>
              </ListLink>
              <ListLink
                to={recreateRoute(`${SamplingRuleType.TRANSACTION}/`, {
                  routes,
                  location,
                  params,
                  stepBack: -1,
                })}
                role="tab"
                aria-selected={params.ruleType === SamplingRuleType.TRANSACTION}
                tabIndex={params.ruleType === SamplingRuleType.TRANSACTION ? 0 : -1}
                isActive={() => params.ruleType === SamplingRuleType.TRANSACTION}
              >
                {t('Individual Transactions')}
                <Badge>{transactionRules.length}</Badge>
              </ListLink>
            </NavTabs>
          }
        />
        {params.ruleType === SamplingRuleType.TRANSACTION ? (
          <TransactionRules
            rules={transactionRules}
            infoAlert={
              !!traceRules.length
                ? tct('[link] will initiate before these rules', {
                    link: (
                      <Link
                        to={recreateRoute(`${SamplingRuleType.TRACE}/`, {
                          routes,
                          location,
                          params,
                          stepBack: -1,
                        })}
                      >
                        {tn(
                          '%s Distributed Trace rule',
                          '%s Distributed Trace rules',
                          traceRules.length
                        )}
                      </Link>
                    ),
                  })
                : null
            }
            onUpdateRules={newRules =>
              this.handleUpdateRules([...traceRules, ...newRules])
            }
            onDeleteRule={this.handleDeleteRule}
            onAddRule={this.handleOpenRule(SamplingRuleType.TRANSACTION)()}
            onEditRule={this.handleOpenRule(SamplingRuleType.TRANSACTION)}
            disabled={disabled}
          />
        ) : (
          <TraceRules
            rules={traceRules}
            onUpdateRules={newRules =>
              this.handleUpdateRules([...transactionRules, ...newRules])
            }
            onDeleteRule={this.handleDeleteRule}
            onAddRule={this.handleOpenRule(SamplingRuleType.TRACE)()}
            onEditRule={this.handleOpenRule(SamplingRuleType.TRACE)}
            disabled={disabled}
          />
        )}
      </Fragment>
    );
  }
}

export {Sampling};
