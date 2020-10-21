import PropTypes from 'prop-types';
import { Component } from 'react';
import styled from '@emotion/styled';

import {MemberRole} from 'app/types';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import Radio from 'app/components/radio';
import TextBlock from 'app/views/settings/components/text/textBlock';

const Label = styled('label')`
  display: flex;
  flex: 1;
  align-items: center;
  margin-bottom: 0;
`;

type Props = {
  enforceAllowed: boolean;
  disabled: boolean;
  selectedRole: string;
  roleList: MemberRole[];
  setRole: (id: string) => void;
};

class RoleSelect extends Component<Props> {
  static propTypes = {
    /**
     * Whether to disable or not using `allowed` prop from API request
     */
    enforceAllowed: PropTypes.bool,
    disabled: PropTypes.bool,
    selectedRole: PropTypes.string,
    roleList: PropTypes.array,
    setRole: PropTypes.func,
  };

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
