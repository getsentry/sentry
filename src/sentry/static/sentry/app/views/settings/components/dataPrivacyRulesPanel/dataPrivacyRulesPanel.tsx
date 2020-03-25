import React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

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
import Link from 'app/components/links/link';

import DataPrivacyRulesPanelForm from './dataPrivacyRulesPanelForm';
import {RULE_TYPE, METHOD_TYPE} from './utils';

const DEFAULT_RULE_FROM_VALUE = '$string';

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
};

class DataPrivacyRulesPanel extends React.Component<Props, State> {
  state: State = {
    rules: [],
    savedRules: [],
    relayPiiConfig: this.props.relayPiiConfig,
  };

  componentDidMount() {
    this.loadRules();
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
                <Link
                  href="https://docs.sentry.io/data-management/advanced-datascrubbing/"
                  target="_blank"
                >
                  {t('full documentation on data scrubbing')}
                </Link>
              ),
            })}
          </PanelAlert>
          <PanelBody>
            {rules.map(rule => (
              <DataPrivacyRulesPanelForm
                key={rule.id}
                onDelete={this.handleDeleteRule}
                onChange={this.handleChange}
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
            </PanelAction>
          </PanelBody>
        </Panel>
        {!hideButtonBar && (
          <StyledButtonBar gap={1.5}>
            <Button onClick={this.handleCancelForm} disabled={disabled}>
              {t('Cancel')}
            </Button>
            <Button priority="primary" onClick={this.handleSaveForm} disabled={disabled}>
              {t('Save Rules')}
            </Button>
          </StyledButtonBar>
        )}
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
  padding: ${space(2)} ${space(3)};
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
