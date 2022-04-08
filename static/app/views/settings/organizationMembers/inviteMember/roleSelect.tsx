import {Component} from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import {MemberRole} from 'sentry/types';
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
  roleList: MemberRole[];
  selectedRole: string;
  setRole: (id: string) => void;
};

class RoleSelect extends Component<Props> {
  render() {
    const {disabled, enforceAllowed, roleList, selectedRole} = this.props;

    return (
      <Panel>
        <PanelHeader>{t('Role')}</PanelHeader>

        <PanelBody>
          {roleList.map(role => {
            const {desc, name, id, allowed} = role;
            const isDisabled = disabled || (enforceAllowed && !allowed);
            return (
              <PanelItem
                key={id}
                onClick={() => !isDisabled && this.props.setRole(id)}
                css={!isDisabled ? {} : {color: 'grey', cursor: 'default'}}
              >
                <Label>
                  <Radio id={id} value={name} checked={id === selectedRole} readOnly />
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

export default RoleSelect;
