import React from 'react';
import PropTypes from 'prop-types';

import Radio from '../../components/radio';

import {t} from '../../locale';

const RoleSelect = React.createClass({
  propTypes: {
    selectedRole: PropTypes.string,
    roleList: PropTypes.array,
    setRole: PropTypes.func,
  },

  render() {
    let {roleList, selectedRole} = this.props;

    return (
      <div className="new-invite-team box">
        <div className="box-header">
          <h4>{t('Role')}</h4>
        </div>
        <div className="box-content with-padding">
          <ul className="radio-inputs">
            {roleList.map((role, i) => {
              let {desc, name, id, allowed} = role;
              return (
                <li
                  className="radio"
                  key={id}
                  onClick={() => allowed && this.props.setRole(id)}
                  style={allowed ? {} : {color: 'grey', cursor: 'default'}}
                >
                  <label style={allowed ? {} : {cursor: 'default'}}>
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
  },
});

export default RoleSelect;
