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

import {defaultSuggestions} from './dataPrivacyRulesPanelForm/dataPrivacyRulesPanelFormSelectorFieldSuggestions';
import DataPrivacyRulesPanelRuleModal from './dataPrivacyRulesPanelRuleModal';
import DataPrivacyRulesPanelContent from './dataPrivacyRulesPanelContent';
import {RULE_TYPE, METHOD_TYPE, EVENT_ID_FIELD_STATUS} from './utils';

const ADVANCED_DATASCRUBBING_LINK =
  'https://docs.sentry.io/data-management/advanced-datascrubbing/';

type Rule = NonNullable<
  React.ComponentProps<typeof DataPrivacyRulesPanelRuleModal>['rule']
>;

type EventId = React.ComponentProps<typeof DataPrivacyRulesPanelRuleModal>['eventId'];

type Suggestions = React.ComponentProps<
  typeof DataPrivacyRulesPanelRuleModal
>['selectorSuggestions'];

type PiiConfig = {
  type: RULE_TYPE;
  pattern: string;
  redaction?: {
    method?: METHOD_TYPE;
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
  selectorSuggestions: Suggestions;
  eventId: EventId;
  showAddRuleModal?: boolean;
};

class DataPrivacyRulesPanel extends React.Component<Props, State> {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
    selectorSuggestions: [],
    eventId: {
      value: '',
    },
  };

  componentDidMount() {
    this.loadRules();
    this.loadSelectorSuggestions();
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
                type: type as RULE_TYPE,
                method: method as METHOD_TYPE,
                from: application,
              });
            }
            continue;
          }

          const resolvedRule = rules[rule];
          if (resolvedRule.type === RULE_TYPE.PATTERN && resolvedRule.pattern) {
            const method = resolvedRule?.redaction?.method;

            convertedRules.push({
              id: convertedRules.length,
              type: RULE_TYPE.PATTERN,
              method: method as METHOD_TYPE,
              from: application,
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

  loadSelectorSuggestions = async () => {
    const {organization, project} = this.context;
    const {eventId} = this.state;

    if (!eventId.value) {
      this.setState(prevState => ({
        selectorSuggestions: defaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: undefined,
        },
      }));
      return;
    }

    this.setState(prevState => ({
      selectorSuggestions: defaultSuggestions,
      eventId: {
        ...prevState.eventId,
        status: EVENT_ID_FIELD_STATUS.LOADING,
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
      const selectorSuggestions: Suggestions = rawSuggestions.suggestions;

      if (selectorSuggestions && selectorSuggestions.length > 0) {
        this.setState(prevState => ({
          selectorSuggestions,
          eventId: {
            ...prevState.eventId,
            status: EVENT_ID_FIELD_STATUS.LOADED,
          },
        }));
        return;
      }

      this.setState(prevState => ({
        selectorSuggestions: defaultSuggestions,
        eventId: {
          ...prevState.eventId,
          status: EVENT_ID_FIELD_STATUS.LOADED,
        },
      }));
    } catch {
      this.setState(prevState => ({
        eventId: {
          ...prevState.eventId,
          status: EVENT_ID_FIELD_STATUS.ERROR,
        },
      }));
    }
  };

  handleSubmit = async () => {
    const {endpoint} = this.props;
    const {rules} = this.state;

    let customRulesCounter = 0;
    const applications: Applications = {};
    const customRules: PiiConfigRule = {};

    for (const rule of rules) {
      let ruleName = `@${rule.type}:${rule.method}`;
      if (rule.type === RULE_TYPE.PATTERN && rule.customRegularExpression) {
        ruleName = `customRule${customRulesCounter}`;

        customRulesCounter += 1;

        customRules[ruleName] = {
          type: RULE_TYPE.PATTERN,
          pattern: rule.customRegularExpression,
          redaction: {
            method: rule.method,
          },
        };
      }

      if (!applications[rule.from]) {
        applications[rule.from] = [];
      }

      if (!applications[rule.from].includes(ruleName)) {
        applications[rule.from].push(ruleName);
      }
    }

    const piiConfig = {
      rules: customRules,
      applications,
    };

    const relayPiiConfig = JSON.stringify(piiConfig);

    await this.api
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
      })
      .catch(error => {
        const errorMessage = error.responseJSON?.relayPiiConfig[0];

        if (!errorMessage) {
          addErrorMessage(t('Unknown error occurred while saving data privacy rules'));
          return;
        }

        if (errorMessage.startsWith('invalid selector: ')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('1 | ')) {
              const selector = line.slice(3);
              addErrorMessage(t('Invalid selector: %s', selector));
              break;
            }
          }
          return;
        }

        if (errorMessage.startsWith('regex parse error:')) {
          for (const line of errorMessage.split('\n')) {
            if (line.startsWith('error:')) {
              const regex = line.slice(6).replace(/at line \d+ column \d+/, '');
              addErrorMessage(t('Invalid regex: %s', regex));
              break;
            }
          }
          return;
        }

        addErrorMessage(t('Unknown error occurred while saving data privacy rules'));
      });
  };

  handleAddRule = (newRule: Rule) => {
    this.setState(
      prevState => ({
        rules: [
          ...prevState.rules,
          {
            ...newRule,
            id: prevState.rules.length + 1,
          },
        ],
      }),
      () => {
        this.handleSubmit();
      }
    );
  };

  handleDeleteRule = (rulesToBeDeleted: Array<Rule['id']>) => {
    this.setState(
      prevState => ({
        rules: prevState.rules.filter(rule => !rulesToBeDeleted.includes(rule.id)),
      }),
      () => {
        this.handleSubmit();
      }
    );
  };

  handleUpdateRule = (updatedRule: Rule) => {
    this.setState(
      prevState => ({
        rules: prevState.rules.map(rule => {
          if (rule.id === updatedRule.id) {
            return updatedRule;
          }
          return rule;
        }),
      }),
      () => {
        this.handleSubmit();
      }
    );
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
      () => {
        this.loadSelectorSuggestions();
      }
    );
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {rules, selectorSuggestions, showAddRuleModal, eventId} = this.state;

    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>
            <div>{t('Data Privacy Rules')}</div>
          </PanelHeader>
          <PanelAlert type="info">
            {additionalContext}{' '}
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
              selectorSuggestions={selectorSuggestions}
            />
            <PanelAction>
              <Button
                size="small"
                disabled={disabled}
                onClick={this.handleToggleAddRuleModal(true)}
                priority="primary"
              >
                {t('Add Rule')}
              </Button>
              <Button
                size="small"
                href={ADVANCED_DATASCRUBBING_LINK}
                target="_blank"
                disabled={disabled}
              >
                {t('Learn More')}
              </Button>
            </PanelAction>
          </PanelBody>
        </Panel>
        {showAddRuleModal && (
          <DataPrivacyRulesPanelRuleModal
            selectorSuggestions={selectorSuggestions}
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

export default DataPrivacyRulesPanel;

const PanelAction = styled('div')`
  padding: ${space(1)} ${space(2)};
  position: relative;
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: auto auto;
  justify-content: flex-start;
  border-top: 1px solid ${p => p.theme.borderDark};
`;
