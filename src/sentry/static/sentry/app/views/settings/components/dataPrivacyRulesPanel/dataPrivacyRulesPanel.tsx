import React from 'react';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';

import {t, tct} from 'app/locale';
import {Panel, PanelAlert, PanelBody} from 'app/components/panels';
import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';
import SentryTypes from 'app/sentryTypes';

import {EventIdFieldStatus} from './dataPrivacyRulesEventIdField';
import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';
import {Suggestion, defaultSuggestions} from './dataPrivacyRulesPanelSelectorFieldTypes';
import {RULE_TYPE, METHOD_TYPE} from './utils';
import DataprivacyRulesPanelHeader from './dataprivacyRulesPanelHeader';
import DataPrivacyRulesPanelFooter from './dataPrivacyRulesPanelFooter';

const DEFAULT_RULE_FROM_VALUE = '';

type Rule = React.ComponentProps<typeof DataPrivacyRulesPanelForm>['rule'];

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
  selectorSuggestions: Array<Suggestion>;
  eventIdInputValue: string;
  eventIdStatus: EventIdFieldStatus;
  isFormValid: boolean;
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
    eventIdStatus: EventIdFieldStatus.NONE,
    eventIdInputValue: '',
    isFormValid: true,
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
    const {eventIdInputValue} = this.state;

    if (!eventIdInputValue) {
      this.setState({
        selectorSuggestions: defaultSuggestions,
        eventIdStatus: EventIdFieldStatus.NONE,
      });
      return;
    }

    this.setState({eventIdStatus: EventIdFieldStatus.LOADING});

    try {
      const query: {projectId?: string; eventId: string} = {eventId: eventIdInputValue};
      if (project?.id) {
        query.projectId = project.id;
      }
      const rawSuggestions = await this.api.requestPromise(
        `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/`,
        {method: 'GET', query}
      );
      const selectorSuggestions: Array<Suggestion> = rawSuggestions.suggestions;

      if (selectorSuggestions && selectorSuggestions.length > 0) {
        this.setState({
          selectorSuggestions,
          eventIdStatus: EventIdFieldStatus.LOADED,
        });
        return;
      }

      this.setState({
        selectorSuggestions: defaultSuggestions,
        eventIdStatus: EventIdFieldStatus.NOT_FOUND,
      });
    } catch {
      this.setState({
        eventIdStatus: EventIdFieldStatus.ERROR,
      });
    }
  };

  handleEventIdChange = (value: string) => {
    const eventId = value.replace(/-/g, '').trim();
    this.setState({
      eventIdStatus: EventIdFieldStatus.NONE,
      selectorSuggestions: defaultSuggestions,
      eventIdInputValue: eventId,
    });
  };

  isEventIdValueValid = (): boolean => {
    const {eventIdInputValue} = this.state;
    if (eventIdInputValue && eventIdInputValue.length !== 32) {
      this.setState({eventIdStatus: EventIdFieldStatus.INVALID});
      return false;
    }

    return true;
  };

  handleEventIdBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    event.preventDefault();

    if (this.isEventIdValueValid()) {
      this.loadSelectorSuggestions();
    }
  };

  handleEventIdKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.persist();

    const {keyCode} = event;

    if (keyCode === 13 && this.isEventIdValueValid()) {
      this.loadSelectorSuggestions();
    }
  };

  handleAddRule = () => {
    this.setState(prevState => ({
      rules: [
        ...prevState.rules,
        {
          id: prevState.rules.length + 1,
          type: RULE_TYPE.CREDITCARD,
          method: METHOD_TYPE.MASK,
          from: DEFAULT_RULE_FROM_VALUE,
        },
      ],
      isFormValid: false,
    }));
  };

  handleDeleteRule = (ruleId: number) => {
    this.setState(prevState => ({
      rules: prevState.rules.filter(rule => rule.id !== ruleId),
    }));
  };

  handleChange = (updatedRule: Rule) => {
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
        this.handleValidation();
      }
    );
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

  handleValidation = () => {
    const {rules} = this.state;
    const isAnyRuleFieldEmpty = rules.find(rule => {
      const ruleKeys = Object.keys(omit(rule, 'id'));
      const anyEmptyField = ruleKeys.find(ruleKey => !rule[ruleKey]);
      return !!anyEmptyField;
    });

    const isFormValid = !isAnyRuleFieldEmpty;

    this.setState({
      isFormValid,
    });
  };

  handleSaveForm = () => {
    const {isFormValid} = this.state;

    if (isFormValid) {
      this.handleSubmit();
      return;
    }

    addErrorMessage(t('Invalid rules form'));
  };

  handleCancelForm = () => {
    this.setState(prevState => ({
      rules: prevState.savedRules,
    }));
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {
      rules,
      savedRules,
      eventIdInputValue,
      selectorSuggestions,
      eventIdStatus,
      isFormValid,
    } = this.state;

    return (
      <React.Fragment>
        <Panel>
          <DataprivacyRulesPanelHeader
            onKeyDown={this.handleEventIdKeyDown}
            onChange={this.handleEventIdChange}
            onBlur={this.handleEventIdBlur}
            value={eventIdInputValue}
            status={eventIdStatus}
            disabled={disabled}
          />
          <PanelAlert type="info">
            {additionalContext}{' '}
            {tct('For more details, see [linkToDocs].', {
              linkToDocs: (
                <ExternalLink href="https://docs.sentry.io/data-management/advanced-datascrubbing/">
                  {t('full documentation on data scrubbing')}
                </ExternalLink>
              ),
            })}
          </PanelAlert>
          <PanelBody>
            {rules.map(rule => (
              <DataPrivacyRulesPanelForm
                key={rule.id}
                onDelete={this.handleDeleteRule}
                onChange={this.handleChange}
                selectorSuggestions={selectorSuggestions}
                rule={rule}
                disabled={disabled}
              />
            ))}
          </PanelBody>
          <DataPrivacyRulesPanelFooter
            onAddRule={this.handleAddRule}
            onCancel={this.handleCancelForm}
            onSave={this.handleSaveForm}
            disabled={disabled}
            disableCancelbutton={
              (savedRules.length === 0 && rules.length === 0) ||
              isEqual(rules, savedRules)
            }
            disableSaveButton={
              !isFormValid ||
              (savedRules.length === 0 && rules.length === 0) ||
              isEqual(rules, savedRules)
            }
          />
        </Panel>
      </React.Fragment>
    );
  }
}

export default DataPrivacyRulesPanel;
