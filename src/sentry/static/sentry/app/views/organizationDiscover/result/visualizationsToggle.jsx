import PropTypes from 'prop-types';
import React from 'react';
import {Box, Flex} from 'grid-emotion';
import classNames from 'classnames';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import Link from 'app/components/link';
import {downloadAsCsv} from './utils';
import {t} from 'app/locale';

import {ResultViewButtons, ResultViewDropdownButtons, DownloadTab, DownloadTabIcon} from '../styles';

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
      <li key={opt.id} className={classNames({active})}>
        <a onClick={() => this.props.handleChange(opt.id)}>
          {opt.name}
        </a>
      </li>
    );
  };

  render() {
    const {options, visualization} = this.props;
    const name = options.find(opt => opt.id === visualization).name;
    const dropdownTitle = t(`View: ${name}`);

    return (
      <React.Fragment>
        <ResultViewButtons underlined>
          {options.map(opt => {
            return this.getButtonItems(opt);
          })}
          <DownloadTab onClick={() => downloadAsCsv(baseQuery.data)}>
            <DownloadTabIcon src="icon-download" />
            {t('Export CSV')}
          </DownloadTab>
        </ResultViewButtons>
        <ResultViewDropdownButtons>
          <DropdownLink title={dropdownTitle} className={'btn btn-default btn-sm'}>
            {options.map(opt => {
              return this.getMenuItem(opt);
            })}
          </DropdownLink>
          <Box ml={1}>
            <Link className='btn btn-default btn-sm' onClick={() => downloadAsCsv(baseQuery.data)}>
              {t('Export CSV')}
            </Link>
          </Box>
        </ResultViewDropdownButtons>
      </React.Fragment>
    );
  }
}

export default VisualizationsToggle;
