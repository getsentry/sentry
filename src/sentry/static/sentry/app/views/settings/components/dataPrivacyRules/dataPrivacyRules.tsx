import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'app/components/panels';
import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';

import {defaultSuggestions as sourceDefaultSuggestions} from './dataPrivacyRulesForm/dataPrivacyRulesFormSourceSuggestions';
import DataPrivacyRulesModal from './dataPrivacyRulesModal';
import DataPrivacyRulesPanelContent from './dataPrivacyRulesContent';
import {RuleType, MethodType, EventIdStatus} from './dataPrivacyRulesForm/types';
import DataPrivacyRulesPanelForm from './dataPrivacyRulesForm/dataPrivacyRulesForm';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/data-management/advanced-datascrubbing/';

type DataPrivacyRulesPanelFormProps = React.ComponentProps<
  typeof DataPrivacyRulesPanelForm
>;
type ModalProps = React.ComponentProps<typeof DataPrivacyRulesModal>;
type Rule = NonNullable<ModalProps['rule']>;
type SourceSuggestions = ModalProps['sourceSuggestions'];
type Errors = DataPrivacyRulesPanelFormProps['errors'];

type PiiConfig = {
  type: RuleType;
  pattern: string;
  redaction?: {
    method?: MethodType;
  };
};

type PiiConfigRule = {
  [key: string]: PiiConfig;
};

type Applications = {[key: string]: Array<string>};

type Props = {
  disabled?: boolean;
  endpoint: string;
  relayPiiConfig?: string;
  additionalContext?: React.ReactNode;
};

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
  relayPiiConfig?: string;
  sourceSuggestions: SourceSuggestions;
  eventId: ModalProps['eventId'];
  showAddRuleModal?: boolean;
};

class DataPrivacyRules extends React.Component<Props, State> {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
    sourceSuggestions: [],
    eventId: {
      value: '',
    },
  };

  componentDidMount() {
    this.loadRules();
    this.loadSourceSuggestions();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

  loadRules() {
    try {
      const relayPiiConfig = this.state.relayPiiConfig;
      const piiConfig = relayPiiConfig ? JSON.parse(relayPiiConfig) : {};
      const rules: PiiConfigRule = piiConfig.rules || {};
      const applications: Applications = piiConfig.applications || {};
      const convertedRules: Array<Rule> = [];

      for (const application in applications) {
        for (const rule of applications[application]) {
          if (!rules[rule]) {
            if (rule[0] === '@') {
              const [type, method] = rule.slice(1).split(':');
              convertedRules.push({
                id: convertedRules.length,
                type: type as RuleType,
                method: method as MethodType,
                source: application,
              });
            }
            continue;
          }

          const resolvedRule = rules[rule];
          if (resolvedRule.type === RuleType.PATTERN && resolvedRule.pattern) {
            const method = resolvedRule?.redaction?.method;

            convertedRules.push({
              id: convertedRules.length,
              type: RuleType.PATTERN,
              method: method as MethodType,
              source: application,
              customRegularExpression: resolvedRule.pattern,
            });
          }
        }
      }

      this.setState({
        rules: convertedRules,
        savedRules: convertedRules,
      });
    } catch {
      addErrorMessage(t('Unable to load the rules'));
    }
  }

  loadSourceSuggestions = async () => {
    const {organization, project} = this.context;
    const {eventId} = this.state;

    if (!eventId.value) {
      this.setState(prevState => ({
        sourceSuggestions: sourceDefaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: undefined,
        },
      }));
      return;
    }

    this.setState(prevState => ({
      sourceSuggestions: sourceDefaultSuggestions,
      eventId: {
        ...prevState.eventId,
        status: EventIdStatus.LOADING,
      },
    }));

    try {
      const query: {projectId?: string; eventId: string} = {eventId: eventId.value};
      if (project?.id) {
        query.projectId = project.id;
      }
      const rawSuggestions = await this.api.requestPromise(
        `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/`,
        {method: 'GET', query}
      );
      const sourceSuggestions: SourceSuggestions = rawSuggestions.suggestions;

      if (sourceSuggestions && sourceSuggestions.length > 0) {
        this.setState(prevState => ({
          sourceSuggestions,
          eventId: {
            ...prevState.eventId,
            status: EventIdStatus.LOADED,
          },
        }));
        return;
      }

      this.setState(prevState => ({
        sourceSuggestions: sourceDefaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.LOADED,
        },
      }));
    } catch {
      this.setState(prevState => ({
        eventId: {
          ...prevState.eventId,
          status: EventIdStatus.ERROR,
        },
      }));
    }
  };

  handleSubmit = async (rules: Array<Rule>) => {
    const {endpoint} = this.props;

    const errors: Errors = {};

    let customRulesCounter = 0;
    const applications: Applications = {};
    const customRules: PiiConfigRule = {};

    for (const rule of rules) {
      let ruleName = `@${rule.type}:${rule.method}`;
      if (rule.type === RuleType.PATTERN && rule.customRegularExpression) {
        ruleName = `customRule${customRulesCounter}`;

        customRulesCounter += 1;

        customRules[ruleName] = {
          type: RuleType.PATTERN,
          pattern: rule.customRegularExpression,
          redaction: {
            method: rule.method,
          },
        };
      }

      if (!applications[rule.source]) {
        applications[rule.source] = [];
      }

      if (!applications[rule.source].includes(ruleName)) {
        applications[rule.source].push(ruleName);
      }
    }

    const piiConfig = {
      rules: customRules,
      applications,
    };

    const relayPiiConfig = JSON.stringify(piiConfig);

    return await this.api
      .requestPromise(endpoint, {
        method: 'PUT',
        data: {relayPiiConfig},
      })
      .then(() => {
        this.setState({
          relayPiiConfig,
        });
      })
      .then(() => {
        addSuccessMessage(t('Successfully saved data privacy rules'));
        return undefined;
      })
      .catch(error => {
        const errorMessage = error.responseJSON?.relayPiiConfig[0];

        if (!errorMessage) {
          addErrorMessage(t('Unknown error occurred while saving data privacy rules'));
          return undefined;
        }

        if (errorMessage.startsWith('invalid selector: ')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('1 | ')) {
              const selector = line.slice(3);
              errors.source = t('Invalid source value: %s', selector);
              break;
            }
          }
          return {
            errors,
          };
        }

        if (errorMessage.startsWith('regex parse error:')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('error:')) {
              const regex = line.slice(6).replace(/at line \d+ column \d+/, '');
              errors.customRegularExpression = t('Invalid regex: %s', regex);
              break;
            }
          }
          return {
            errors,
          };
        }

        addErrorMessage(t('Unknown error occurred while saving data privacy rules'));
        return undefined;
      });
  };

  handleAddRule = async (rule: Rule) => {
    const newRule = {
      ...rule,
      id: this.state.rules.length,
    };

    const rules = [...this.state.rules, newRule];

    return await this.handleSubmit(rules).then(result => {
      if (!result) {
        this.setState({
          rules,
        });
        return undefined;
      }
      return result;
    });
  };

  handleUpdateRule = async (updatedRule: Rule) => {
    const rules = this.state.rules.map(rule => {
      if (rule.id === updatedRule.id) {
        return updatedRule;
      }
      return rule;
    });

    return await this.handleSubmit(rules).then(result => {
      if (!result) {
        this.setState({
          rules,
        });
        return undefined;
      }
      return result;
    });
  };

  handleDeleteRule = async (rulesToBeDeleted: Array<Rule['id']>) => {
    const rules = this.state.rules.filter(rule => !rulesToBeDeleted.includes(rule.id));
    await this.handleSubmit(rules).then(result => {
      if (!result) {
        this.setState({
          rules,
        });
      }
    });
  };

  handleToggleAddRuleModal = (showAddRuleModal: boolean) => () => {
    this.setState({
      showAddRuleModal,
    });
  };

  handleUpdateEventId = (eventId: string) => {
    this.setState(
      {
        eventId: {
          value: eventId,
        },
      },
      this.loadSourceSuggestions
    );
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {rules, sourceSuggestions, showAddRuleModal, eventId} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <div>{t('Data Privacy Rules')}</div>
          </PanelHeader>
          <PanelAlert type="info">
            {additionalContext}{' '}
            {`${t('The new rules will only apply to upcoming events. ')}`}{' '}
            {tct('For more details, see [linkToDocs].', {
              linkToDocs: (
                <ExternalLink href={ADVANCED_DATASCRUBBING_LINK}>
                  {t('full documentation on data scrubbing')}
                </ExternalLink>
              ),
            })}
          </PanelAlert>
          <PanelBody>
            <DataPrivacyRulesPanelContent
              rules={rules}
              disabled={disabled}
              onDeleteRule={this.handleDeleteRule}
              onUpdateRule={this.handleUpdateRule}
              onUpdateEventId={this.handleUpdateEventId}
              eventId={eventId}
              sourceSuggestions={sourceSuggestions}
            />
            <PanelAction>
              <Button
                href={ADVANCED_DATASCRUBBING_LINK}
                target="_blank"
                disabled={disabled}
              >
                {t('Read the docs')}
              </Button>
              <Button
                disabled={disabled}
                onClick={this.handleToggleAddRuleModal(true)}
                priority="primary"
              >
                {t('Add Rule')}
              </Button>
            </PanelAction>
          </PanelBody>
        </Panel>
        {showAddRuleModal && (
          <DataPrivacyRulesModal
            sourceSuggestions={sourceSuggestions}
            onSaveRule={this.handleAddRule}
            onClose={this.handleToggleAddRuleModal(false)}
            onUpdateEventId={this.handleUpdateEventId}
            eventId={eventId}
          />
        )}
      </React.Fragment>
    );
  }
}

export default DataPrivacyRules;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-end;
  border-top: 1px solid ${p => p.theme.borderDark};
`;
