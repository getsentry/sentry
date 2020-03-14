import React from 'react';
import styled from '@emotion/styled';

import {Client, APIRequestMethod} from 'app/api';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {Panel, PanelHeader, PanelBody} from 'app/components/panels';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import ButtonBar from 'app/components/buttonBar';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';

import ProjectDataPrivacyRulesForm from './projectDataPrivacyRulesForm';
import {DataType, ActionType} from './utils';

const INDICATORS_DURATION = 500;

type Rule = React.ComponentProps<typeof ProjectDataPrivacyRulesForm>['rule'];

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
};

type Props = {
  initialData: any;
  apiMethod: APIRequestMethod;
  apiEndpoint: string;
};

class ProjectDataPrivacyRulesPanel extends React.Component<Props, State> {
  constructor(props, context) {
    super(props, context);
    this.api = new Client();
  }

  state: State = {
    rules: [],
    savedRules: [],
  };

  componentDidMount() {
    this.loadRules();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  api: Client;

  loadRules() {
    const piiConfig = JSON.parse(this.props.initialData.relayPiiConfig) || {};
    const applications = piiConfig.applications || {};
    const rules = piiConfig.rules || {};
    const convertedRules: Rule[] = [];

    for (const selector in applications) {
      for (const rule of applications[selector]) {
        if (rules[rule]) {
          const resolvedRule = rules[rule];

          if (resolvedRule.type === 'pattern' && resolvedRule.pattern) {
            const redactionMethod = (resolvedRule.redaction || {}).method;

            convertedRules.push({
              id: convertedRules.length,
              action: redactionMethod as ActionType,
              data: 'pattern',
              customRegularExpression: resolvedRule.pattern as string,
              from: selector,
            });
          }
        } else if (rule[0] === '@') {
          const [ruleType, redactionMethod] = rule.slice(1).split(':');
          convertedRules.push({
            id: convertedRules.length,
            action: redactionMethod as ActionType,
            data: ruleType as DataType,
            from: selector,
          });
        }
      }
    }

    this.setState({
      rules: convertedRules,
      savedRules: convertedRules,
    });
  }

  handleAddRule = () => {
    this.setState(prevState => ({
      rules: [
        ...prevState.rules,
        {
          id: prevState.rules.length + 1,
          action: 'replace',
          data: 'iban',
          from: '$string',
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
    const customRules = {};
    let customRulesCounter = 0;
    const applications = {};

    for (const rule of this.state.rules) {
      let ruleName;
      if (rule.data === 'pattern') {
        ruleName = `customRule${customRulesCounter}`;
        customRulesCounter += 1;

        customRules[ruleName] = {
          type: 'pattern',
          pattern: rule.customRegularExpression,
          redaction: {
            method: rule.action,
          },
        };
      } else {
        ruleName = `@${rule.data}:${rule.action}`;
      }

      applications[rule.from] = applications[rule.from] || [];
      applications[rule.from].push(ruleName);
    }

    const piiConfig = {
      rules: customRules,
      applications,
    };

    this.api.request(this.props.apiEndpoint, {
      method: this.props.apiMethod,
      data: {relayPiiConfig: JSON.stringify(piiConfig)},
      success: (..._args) => {
        clearIndicators();
        addSuccessMessage(t('Successfully saved data scrubbing rules'), {
          duration: INDICATORS_DURATION,
        });
      },
      error: (..._args) => {
        clearIndicators();
        addErrorMessage(t('An error occurred while saving data scrubbing rules'), {
          duration: INDICATORS_DURATION,
        });
      },
    });
  };

  handleValidation = () => {
    const {rules} = this.state;
    const isAnyRuleFieldEmpty = rules.find(rule =>
      Object.keys(rule).find(ruleKey => {
        if (ruleKey === 'customRegularExpression' && rule.data !== 'pattern') {
          return false;
        }

        return !rule[ruleKey];
      })
    );

    const isFormValid = !isAnyRuleFieldEmpty;

    if (isFormValid) {
      this.handleSubmit();
    } else {
      addErrorMessage(t("Invalid rule's form"), {duration: INDICATORS_DURATION});
    }
  };

  handleSaveForm = () => {
    this.handleValidation();
  };

  handleCancelForm = () => {
    addLoadingMessage(t('Cancelling...'), {duration: INDICATORS_DURATION, append: true});
    this.setState(prevState => ({
      rules: prevState.savedRules,
    }));
  };

  render() {
    const {rules} = this.state;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>{t('Data Privacy Rules')}</PanelHeader>
          <PanelBody>
            {rules.map(rule => (
              <ProjectDataPrivacyRulesForm
                key={rule.id}
                onDelete={this.handleDeleteRule}
                onChange={this.handleChange}
                rule={rule}
              />
            ))}
            <PanelAction>
              <StyledButton
                icon={<IconAdd circle />}
                onClick={this.handleAddRule}
                borderless
              >
                {t('Add Rule')}
              </StyledButton>
            </PanelAction>
          </PanelBody>
        </Panel>
        {rules.length > 0 && (
          <StyledButtonBar gap={1.5}>
            <Button onClick={this.handleCancelForm}>{t('Cancel')}</Button>
            <Button priority="primary" onClick={this.handleSaveForm}>
              {t('Save Rules')}
            </Button>
          </StyledButtonBar>
        )}
      </React.Fragment>
    );
  }
}

export default ProjectDataPrivacyRulesPanel;

const PanelAction = styled('div')`
  padding: ${space(2)} ${space(3)};
`;

// TODO(style): color #2c58a8 not yet in the theme
const StyledButton = styled(Button)`
  color: ${p => p.theme.blue};
  :hover {
    color: #2c58a8;
  }
  > *:first-child {
    padding: 0;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  justify-content: flex-end;
`;
