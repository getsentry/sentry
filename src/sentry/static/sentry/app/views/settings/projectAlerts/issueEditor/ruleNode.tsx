import React from 'react';
import styled from '@emotion/styled';

import {
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
  MailActionTargetType,
} from 'app/types/alerts';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import {t, tct} from 'app/locale';
import MailActionFields from 'app/views/settings/projectAlerts/issueEditor/mailActionFields';
import ExternalLink from 'app/components/links/externalLink';
import {Organization, Project} from 'app/types';
import {IconDelete} from 'app/icons';

type FormField = {
  // Type of form fields
  type: string;
  // The rest is configuration for the form field
  [key: string]: any;
};

type Props = {
  index: number;
  node?: IssueAlertRuleActionTemplate | IssueAlertRuleConditionTemplate | null;
  data?: IssueAlertRuleAction | IssueAlertRuleCondition;
  project: Project;
  organization: Organization;
  onDelete: (rowIndex: number) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
};

class RuleNode extends React.Component<Props> {
  handleDelete = () => {
    const {index, onDelete} = this.props;
    onDelete(index);
  };

  handleMailActionChange = (action: IssueAlertRuleAction) => {
    const {index, onPropertyChange} = this.props;
    onPropertyChange(index, 'targetType', `${action.targetType}`);
    onPropertyChange(index, 'targetIdentifier', `${action.targetIdentifier}`);
  };

  getChoiceField = (name: string, fieldConfig: FormField) => {
    // Select the first item on this list
    // If it's not yet defined, call onPropertyChange to make sure the value is set on state
    const {data, index, onPropertyChange} = this.props;
    let initialVal;

    if (data) {
      if (data[name] === undefined && !!fieldConfig.choices.length) {
        if (fieldConfig.initial) {
          initialVal = fieldConfig.initial;
        } else {
          initialVal = fieldConfig.choices[0][0];
        }
      } else {
        initialVal = data[name];
      }
    }

    // Cast `key` to string, this problem pops up because of react-select v3 where
    // `value` requires the `option` object (e.g. {label, object}) - we have
    // helpers in `SelectControl` to filter `choices` to produce the value object
    //
    // However there are integrations that give the form field choices with the value as number, but
    // when the integration configuration gets saved, it gets saved and returned as a string
    const choices = fieldConfig.choices.map(([key, value]) => [`${key}`, value]);

    return (
      <InlineSelectControl
        isClearable={false}
        name={name}
        value={initialVal}
        styles={{
          control: provided => ({
            ...provided,
            minHeight: '28px',
            height: '28px',
          }),
        }}
        choices={choices}
        onChange={({value}) => onPropertyChange(index, name, value)}
      />
    );
  };

  getTextField = (name: string, fieldConfig: FormField) => {
    const {data, index, onPropertyChange} = this.props;

    return (
      <InlineInput
        type="text"
        name={name}
        value={(data && data[name]) ?? ''}
        placeholder={`${fieldConfig.placeholder}`}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(index, name, e.target.value)
        }
      />
    );
  };

  getNumberField = (name: string, fieldConfig: FormField) => {
    const {data, index, onPropertyChange} = this.props;

    return (
      <InlineInput
        type="number"
        name={name}
        value={(data && data[name]) ?? ''}
        placeholder={`${fieldConfig.placeholder}`}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(index, name, e.target.value)
        }
      />
    );
  };

  getMailActionFields = (_: string, __: FormField) => {
    const {data, organization, project} = this.props;
    const isInitialized =
      data?.targetType !== undefined && `${data.targetType}`.length > 0;
    return (
      <MailActionFields
        disabled={false}
        project={project}
        organization={organization}
        loading={!isInitialized}
        action={data as IssueAlertRuleAction}
        onChange={this.handleMailActionChange}
      />
    );
  };

  getField = (name: string, fieldConfig: FormField) => {
    const getFieldTypes = {
      choice: this.getChoiceField,
      number: this.getNumberField,
      string: this.getTextField,
      mailAction: this.getMailActionFields,
    };
    return getFieldTypes[fieldConfig.type](name, fieldConfig);
  };

  renderRow() {
    const {data, node} = this.props;

    if (!node) {
      return null;
    }

    const {label, formFields} = node;

    const parts = label.split(/({\w+})/).map((part, i) => {
      if (!/^{\w+}$/.test(part)) {
        return <Separator key={i}>{part}</Separator>;
      }

      const key = part.slice(1, -1);

      // If matcher is "is set" or "is not set", then we do not want to show the value input
      // because it is not required
      if (key === 'value' && data && (data.match === 'is' || data.match === 'ns')) {
        return null;
      }

      return (
        <Separator key={key}>
          {formFields && formFields.hasOwnProperty(key)
            ? this.getField(key, formFields[key])
            : part}
        </Separator>
      );
    });

    const [title, ...inputs] = parts;

    // We return this so that it can be a grid
    return (
      <Rule>
        {title}
        {inputs}
      </Rule>
    );
  }

  conditionallyRenderHelpfulBanner() {
    const {data, project, organization} = this.props;
    /**
     * Would prefer to check if data is of `IssueAlertRuleAction` type, however we can't do typechecking at runtime as
     * user defined types are erased through transpilation.
     * Instead, we apply duck typing semantics here.
     * See: https://stackoverflow.com/questions/51528780/typescript-check-typeof-against-custom-type
     */
    if (!data?.targetType) {
      return null;
    }

    switch (data.targetType) {
      case MailActionTargetType.IssueOwners:
        return (
          <MarginlessAlert type="warning">
            {tct(
              'If there are no matching [issueOwners], ownership is determined by the [ownershipSettings].',
              {
                issueOwners: (
                  <ExternalLink href="https://docs.sentry.io/workflow/issue-owners/">
                    {t('issue owners')}
                  </ExternalLink>
                ),
                ownershipSettings: (
                  <ExternalLink
                    href={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
                  >
                    {t('ownership settings')}
                  </ExternalLink>
                ),
              }
            )}
          </MarginlessAlert>
        );
      case MailActionTargetType.Team:
        return null;
      case MailActionTargetType.Member:
        return (
          <MarginlessAlert type="warning">
            {tct('Alerts sent directly to a member override their [alertSettings].', {
              alertSettings: (
                <ExternalLink href="/settings/account/notifications/">
                  {t('personal project alert settings')}
                </ExternalLink>
              ),
            })}
          </MarginlessAlert>
        );
      default:
        return null;
    }
  }

  render() {
    const {data} = this.props;

    return (
      <RuleRowContainer>
        <RuleRow>
          {data && <input type="hidden" name="id" value={data.id} />}
          {this.renderRow()}
          <DeleteButton
            label={t('Delete Node')}
            onClick={this.handleDelete}
            type="button"
            size="small"
            icon={<IconDelete />}
          />
        </RuleRow>
        {this.conditionallyRenderHelpfulBanner()}
      </RuleRowContainer>
    );
  }
}

export default RuleNode;

const InlineInput = styled(Input)`
  width: auto;
  height: 28px;
`;

const InlineSelectControl = styled(SelectControl)`
  width: 180px;
`;

const Separator = styled('span')`
  margin-right: ${space(1)};
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;

const RuleRow = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)};
`;

const RuleRowContainer = styled('div')`
  &:nth-child(odd) {
    background-color: ${p => p.theme.gray100};
  }
`;

const Rule = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
`;

const MarginlessAlert = styled(Alert)`
  margin: 0;
`;
