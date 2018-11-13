import PropTypes from 'prop-types';
import React from 'react';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';
import styled from 'react-emotion';
import theme from 'app/utils/theme';

class VisualizationsDropdown extends React.PureComponent {
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

  constructor() {
    super();
  }

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

  getLabel = key => {
    switch (key) {
      case 'table':
        return t('Table');
      case 'line':
        return t('Line');
      case 'bar':
        return t('Bar');
      case 'line-by-day':
        return t('Line by Day');
      case 'bar-by-day':
        return t('Bar by Day');
      default:
        return t('Table');
    }
  };

  render() {
    const {options} = this.props;
    let dropdownTitle = (
      <Title>{t(`View: ${this.getLabel(this.props.visualization)}`)}</Title>
    );

    if (options.length > 1) {
      return (
        <DropdownLink
          btnGroup={true}
          title={dropdownTitle}
          className={'btn btn-default btn-sm'}
        >
          {options.map(opt => {
            return this.getMenuItem(opt);
          })}
        </DropdownLink>
      );
    } else {
      return null;
    }
  }
}

const Title = styled('span')`
  color: ${theme.textColor};
`;

export default VisualizationsDropdown;
