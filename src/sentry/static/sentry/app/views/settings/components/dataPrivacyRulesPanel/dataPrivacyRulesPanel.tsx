import React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import {Panel, PanelHeader, PanelAlert, PanelBody} from 'app/components/panels';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import ButtonBar from 'app/components/buttonBar';
import {Client} from 'app/api';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import ExternalLink from 'app/components/links/externalLink';

import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';
import {Suggestion} from './dataPrivacyRulesPanelSelectorFieldTypes';
import {RULE_TYPE, METHOD_TYPE} from './utils';

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
  selectedEventId?: string;
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
    selectedEventId: undefined,
  };

  componentDidMount() {
    this.loadRules();
    this.loadSelectorSuggestions();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.relayPiiConfig !== this.state.relayPiiConfig) {
      this.loadRules();
    }
    if (prevState.selectedEventId !== this.state.selectedEventId) {
      this.loadSelectorSuggestions();
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

    const queryParams = [
      ["project", project?.id],
      ["eventId", this.state.selectedEventId]
    ]
      .filter(([_k, v]) => !!v).map(([k, v]) => `${k}=${v}`)
      .join("&");

    let selectorSuggestions: Array<Suggestion> = [];

    const rawSuggestions = await this.api.requestPromise(
      `/organizations/${organization.slug}/data-scrubbing-selector-suggestions/?${queryParams}`,
      {method: 'GET'}
    );

    for(const suggestion of rawSuggestions.suggestions || []) {
      selectorSuggestions.push(suggestion);
    }

    this.setState({selectorSuggestions});
  };

  handleEventIdChange = (newValue: string) => {
    const eventId = newValue.replace(/-/g, '').trim();
    if (!eventId || eventId.length == 32) {
      this.setState({selectedEventId: eventId || undefined});
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
    }));
  };

  handleDeleteRule = (ruleId: number) => {
    this.setState(prevState => ({
      rules: prevState.rules.filter(rule => rule.id !== ruleId),
    }));
  };

  handleChange = (updatedRule: Rule) => {
    this.setState(prevState => ({
      rules: prevState.rules.map(rule => {
        if (rule.id === updatedRule.id) {
          return updatedRule;
        }
        return rule;
      }),
    }));
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
        addSuccessMessage(t('Successfully saved data scrubbing rules'));
      })
      .catch(() => {
        addErrorMessage(t('An error occurred while saving data scrubbing rules'));
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

    if (isFormValid) {
      this.handleSubmit();
    } else {
      addErrorMessage(t("Invalid rule's form"));
    }
  };

  handleSaveForm = () => {
    this.handleValidation();
  };

  handleCancelForm = () => {
    addLoadingMessage(t('Canceling...'));
    this.setState(prevState => ({
      rules: prevState.savedRules,
    }));
  };

  render() {
    const {additionalContext, disabled} = this.props;
    const {rules, savedRules} = this.state;
    const hideButtonBar = savedRules.length === 0 && rules.length === 0;
    return (
      <React.Fragment>
        <Panel>
          <StyledPanelHeader>{t('Data Privacy Rules')}</StyledPanelHeader>
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
                selectorSuggestions={this.state.selectorSuggestions}
                selectedEventId={this.state.selectedEventId}
                handleEventIdChange={this.handleEventIdChange}
                rule={rule}
                disabled={disabled}
              />
            ))}
            <PanelAction>
              <StyledLink
                disabled={disabled}
                icon={<IconAdd circle />}
                onClick={this.handleAddRule}
                size="zero"
                borderless
              >
                {t('Add Rule')}
              </StyledLink>
              {!hideButtonBar && (
                <StyledButtonBar gap={1.5}>
                  <Button
                    size="small"
                    onClick={this.handleCancelForm}
                    disabled={disabled}
                  >
                    {t('Cancel')}
                  </Button>
                  <Button
                    size="small"
                    priority="primary"
                    onClick={this.handleSaveForm}
                    disabled={disabled}
                  >
                    {t('Save Rules')}
                  </Button>
                </StyledButtonBar>
              )}
            </PanelAction>
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default DataPrivacyRulesPanel;

const StyledPanelHeader = styled(PanelHeader)`
  display: grid;
  grid-gap: ${space(1)};
`;

const PanelAction = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-end;
`;

const StyledLink = styled(Button)`
  color: ${p => p.theme.blue};

  &:hover,
  &:active,
  &:focus {
    color: ${p => p.theme.blueDark};
  }
`;
