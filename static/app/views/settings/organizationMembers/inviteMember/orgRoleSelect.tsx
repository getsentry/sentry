import {Component} from 'react';
import styled from '@emotion/styled';

import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import Radio from 'sentry/components/radio';
import {t, tct} from 'sentry/locale';
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
  enforceIdpRoleRestricted: boolean;
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
      enforceIdpRoleRestricted,
      roleSelected,
      setSelected,
    } = this.props;

    return (
      <Panel>
        <PanelHeader>
          <div>{t('Organization Role')}</div>
        </PanelHeader>
        {enforceIdpRoleRestricted && (
          <PanelAlert>
            {tct(
              "[person] organization-level role is managed through your organization's identity provider.",
              {person: isCurrentUser ? 'Your' : "This member's"}
            )}
          </PanelAlert>
        )}

        <PanelBody>
          {roleList.map(role => {
            const {desc, name, id, allowed, isRetired: roleRetired} = role;

            const isRetired = enforceRetired && roleRetired;
            const isDisabled =
              disabled ||
              isRetired ||
              (enforceAllowed && !allowed) ||
              enforceIdpRoleRestricted;

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
