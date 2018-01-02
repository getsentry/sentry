import React from 'react';
import PropTypes from 'prop-types';

import Radio from '../../components/radio';

import {t} from '../../locale';

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
      <div className="new-invite-team box">
        <div className="box-header">
          <h4>{t('Role')}</h4>
        </div>
        <div className="box-content with-padding">
          <ul className="radio-inputs">
            {roleList.map((role, i) => {
              let {desc, name, id, allowed} = role;
              let isDisabled = disabled || (enforceAllowed && !allowed);
              return (
                <li
                  className="radio"
                  key={id}
                  onClick={() => !isDisabled && this.props.setRole(id)}
                  style={!isDisabled ? {} : {color: 'grey', cursor: 'default'}}
                >
                  <label style={!isDisabled ? {} : {cursor: 'default'}}>
                    <Radio id={id} value={name} checked={id === selectedRole} readOnly />
                    {name}
                    <div className="help-block">{desc}</div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
}

export default RoleSelect;
