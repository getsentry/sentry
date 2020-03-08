import React from 'react';
import styled from '@emotion/styled';

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
import {DATA_TYPE, ACTION_TYPE} from './utils';

const INDICATORS_DURATION = 500;

type Rule = React.ComponentProps<typeof ProjectDataPrivacyRulesForm>['rule'];

type State = {
  rules: Array<Rule>;
  savedRules: Array<Rule>;
};

let requestResponse: Array<Rule> = [
  {
    id: 1,
    action: ACTION_TYPE.MASK,
    data: DATA_TYPE.BANK_ACCOUNTS,
    from: 'api_key && !$object',
  },
  {
    id: 2,
    action: ACTION_TYPE.REMOVE,
    data: DATA_TYPE.IP_ADDRESSES,
    from: 'xxx && xxx',
  },
];

class ProjectDataPrivacyRulesPanel extends React.Component<{}, State> {
  state: State = {
    rules: [],
    savedRules: [],
  };

  componentDidMount() {
    this.loadRules();
  }

  loadRules = async () => {
    addLoadingMessage(t('Loading...'));
    // add request here
    try {
      const result: Array<Rule> = await new Promise(resolve => {
        setTimeout(async function() {
          resolve(requestResponse);
        }, 1000);
      });
      this.setState(
        {
          rules: result,
          savedRules: result,
        },
        () => {
          clearIndicators();
        }
      );
    } catch (err) {
      addErrorMessage(t('Unable to load rules'), {duration: INDICATORS_DURATION});
      throw err;
    }
  };

  handleAddRule = () => {
    this.setState(prevState => ({
      rules: [
        ...prevState.rules,
        {
          id: prevState.rules.length + 1,
          action: ACTION_TYPE.MASK,
          data: DATA_TYPE.BANK_ACCOUNTS,
          from: '',
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
    const rules = this.state.rules;
    try {
      const result: Array<Rule> = await new Promise(resolve => {
        setTimeout(async function() {
          requestResponse = rules;
          resolve(requestResponse);
        }, 1000);
      });
      this.setState(
        {
          rules: result,
        },
        () => {
          addSuccessMessage(t("Successfully saved the rule's form"), {
            duration: INDICATORS_DURATION,
          });
        }
      );
    } catch (err) {
      addErrorMessage(t("An error occurred while saving the rule's form"), {
        duration: INDICATORS_DURATION,
      });
      throw err;
    }
  };

  handleValidation = () => {
    const {rules} = this.state;
    const isAnyRuleFieldEmpty = rules.find(rule =>
      Object.keys(rule).find(ruleKey => {
        if (
          ruleKey === 'customRegularExpression' &&
          rule.data !== DATA_TYPE.CUSTOM_REGULAR_EXPRESSION
        ) {
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
