import React from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import space from 'app/styles/space';
import {t} from 'app/locale';
import {Panel, PanelHeader, PanelBody} from 'app/components/panels';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons/iconAdd';
import ButtonBar from 'app/components/buttonBar';
import {Client} from 'app/api';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';

import ProjectDataPrivacyRulesForm from './projectDataPrivacyRulesForm';
import {RULE_TYPE, METHOD_TYPE} from './utils';

const INDICATORS_DURATION = 500;
const DEFAULT_RULE_FROM_VALUE = '$string';

type Rule = React.ComponentProps<typeof ProjectDataPrivacyRulesForm>['rule'];

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
  orgId: string;
  projectId: string;
  relayPiiConfig?: string;
};

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
  relayPiiConfig?: string;
};

class ProjectDataPrivacyRulesPanel extends React.Component<Props, State> {
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
          type: RULE_TYPE.IBAN,
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
    const {orgId, projectId} = this.props;
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
      .requestPromise(`/projects/${orgId}/${projectId}/`, {
        method: 'PUT',
        data: {relayPiiConfig},
      })
      .then(() => {
        this.setState({
          relayPiiConfig,
        });
      })
      .then(() => {
        addSuccessMessage(t('Successfully saved data scrubbing rules'), {
          duration: INDICATORS_DURATION,
        });
      })
      .catch(() => {
        addErrorMessage(t('An error occurred while saving data scrubbing rules'), {
          duration: INDICATORS_DURATION,
        });
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
      addErrorMessage(t("Invalid rule's form"), {duration: INDICATORS_DURATION});
    }
  };

  handleSaveForm = () => {
    this.handleValidation();
  };

  handleCancelForm = () => {
    addLoadingMessage(t('Cancelling...'), {duration: INDICATORS_DURATION});
    this.setState(prevState => ({
      rules: prevState.savedRules,
    }));
  };

  render() {
    const {rules, savedRules} = this.state;
    const hideButtonBar = savedRules.length === 0 && rules.length === 0;
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
        {!hideButtonBar && (
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
