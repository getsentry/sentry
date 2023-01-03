import {Component} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import {OrgRole} from 'sentry/types';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const Label = styled('label')`
  display: flex;
  flex: 1;
  align-items: center;
  margin-bottom: 0;
`;

type Props = {
  disabled: boolean;
  enforceAllowed: boolean;
  enforceRetired: boolean;
  isCurrentUser: boolean;
  roleList: OrgRole[];
  roleSelected: string;
  setSelected: (id: string) => void;
};

class OrganizationRoleSelect extends Component<Props> {
  render() {
    const {
      disabled,
      enforceRetired,
      enforceAllowed,
      isCurrentUser,
      roleList,
      roleSelected,
      setSelected,
    } = this.props;

    return (
      <Panel>
        <PanelHeader>
          <div>
            {t('Organization Role')}{' '}
            <QuestionTooltip
              title={
                isCurrentUser
                  ? "Your organization-level role is managed through your organization's identity provider."
                  : "This member's organization-level role is managed through your organization's identity provider."
              }
              size="xs"
            />
          </div>
        </PanelHeader>

        <PanelBody>
          {roleList.map(role => {
            const {desc, name, id, allowed, isRetired: roleRetired} = role;

            const isRetired = enforceRetired && roleRetired;
            const isDisabled = disabled || isRetired || (enforceAllowed && !allowed);

            return (
              <PanelItem
                key={id}
                onClick={() => !isDisabled && setSelected(id)}
                css={!isDisabled ? {} : {color: 'grey', cursor: 'default'}}
              >
                <Label>
                  <Radio id={id} value={name} checked={id === roleSelected} readOnly />
                  <div style={{flex: 1, padding: '0 16px'}}>
                    {name}
                    <TextBlock noMargin>
                      <div className="help-block">{desc}</div>
                    </TextBlock>
                  </div>
                </Label>
              </PanelItem>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

export default OrganizationRoleSelect;
