import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';

import {ResultViewButtons, ResultViewDropdownButtons} from '../styles';

class VisualizationsToggle extends React.Component {
  static propTypes = {
    options: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
      })
    ).isRequired,
    handleChange: PropTypes.func.isRequired,
    visualization: PropTypes.string.isRequired,
  };

  getMenuItem = opt => {
    return (
      <MenuItem
        key={opt.id}
        onSelect={this.props.handleChange}
        eventKey={opt.id}
        isActive={opt.id === this.props.visualization}
      >
        {opt.name}
      </MenuItem>
    );
  };

  getButtonItems = opt => {
    const active = opt.id === this.props.visualization;
    return (
      <a
        key={opt.id}
        className={classNames('btn btn-default btn-sm', {active})}
        onClick={() => this.props.handleChange(opt.id)}
      >
        {opt.name}
      </a>
    );
  };

  render() {
    const {options, visualization} = this.props;
    const name = options.find(opt => opt.id === visualization).name;
    const dropdownTitle = t(`View: ${name}`);

    return (
      <React.Fragment>
        <ResultViewButtons className="btn-group">
          {options.map(opt => {
            return this.getButtonItems(opt);
          })}
        </ResultViewButtons>
        <ResultViewDropdownButtons>
          <DropdownLink title={dropdownTitle} className={'btn btn-default btn-sm'}>
            {options.map(opt => {
              return this.getMenuItem(opt);
            })}
          </DropdownLink>
        </ResultViewDropdownButtons>
      </React.Fragment>
    );
  }
}

export default VisualizationsToggle;
