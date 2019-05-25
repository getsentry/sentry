import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';

import {
  ResultViewActions,
  ResultViewButtons,
  ResultViewDropdownButtons,
  DownloadCsvButton,
} from '../styles';

class VisualizationsToggle extends React.Component {
  static propTypes = {
    options: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
      })
    ).isRequired,
    handleChange: PropTypes.func.isRequired,
    handleCsvDownload: PropTypes.func.isRequired,
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
      <li key={opt.id} className={classNames({active})}>
        <a onClick={() => this.props.handleChange(opt.id)}>{opt.name}</a>
      </li>
    );
  };

  getDownloadCsvButton = () => {
    const {handleCsvDownload} = this.props;
    return (
      <DownloadCsvButton onClick={handleCsvDownload} icon="icon-download" size="xsmall">
        {t('Export CSV')}
      </DownloadCsvButton>
    );
  };

  render() {
    const {options, visualization} = this.props;
    const name = options.find(opt => opt.id === visualization).name;
    const dropdownTitle = t(`View: ${name}`);

    return (
      <ResultViewActions>
        <ResultViewButtons>
          {options.map(opt => {
            return this.getButtonItems(opt);
          })}
        </ResultViewButtons>
        <ResultViewDropdownButtons>
          <DropdownLink title={dropdownTitle} className="btn btn-default btn-sm">
            {options.map(opt => {
              return this.getMenuItem(opt);
            })}
          </DropdownLink>
        </ResultViewDropdownButtons>
        {this.getDownloadCsvButton()}
      </ResultViewActions>
    );
  }
}

export default VisualizationsToggle;
