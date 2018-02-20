import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../locale';
import Panel from '../settings/components/panel';
import PanelBody from '../settings/components/panelBody';
import PanelHeader from '../settings/components/panelHeader';
import PanelItem from '../settings/components/panelItem';
import Radio from '../../components/radio';
import TextBlock from '../settings/components/text/textBlock';

const Label = styled.label`
  ${p => (p.disabled ? 'cursor: default' : '')};
  display: flex;
  flex: 1;
  align-items: center;
  margin-bottom: 0;
`;

class RoleSelect extends React.Component {
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
    let {disabled, enforceAllowed, roleList, selectedRole} = this.props;

    return (
      <Panel className="new-invite-team">
        <PanelHeader>{t('Role')}</PanelHeader>

        <PanelBody>
          {roleList.map((role, i) => {
            let {desc, name, id, allowed} = role;
            let isDisabled = disabled || (enforceAllowed && !allowed);
            return (
              <PanelItem
                key={id}
                onClick={() => !isDisabled && this.props.setRole(id)}
                css={!isDisabled ? {} : {color: 'grey', cursor: 'default'}}
              >
                <Label>
                  <Radio
                    id={id}
                    value={name}
                    checked={id === selectedRole}
                    readOnly
                    style={{margin: 0}}
                  />
                  <div style={{flex: 1, padding: '0 16px'}}>
                    {name}
                    <TextBlock css={{marginBottom: 0}}>
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
