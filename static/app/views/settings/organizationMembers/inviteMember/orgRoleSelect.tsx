import {Component} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
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
      roleList,
      roleSelected,
      setSelected,
    } = this.props;

    return (
      <Panel>
        <PanelHeader>{t('Organization Role')}</PanelHeader>

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
