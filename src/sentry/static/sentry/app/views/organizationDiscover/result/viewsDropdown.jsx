import PropTypes from 'prop-types';
import React from 'react';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';
import styled from 'react-emotion';
import theme from 'app/utils/theme';

class ViewsDropdown extends React.PureComponent {
  static propTypes = {
    options: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
      })
    ).isRequired,
    handleChange: PropTypes.func.isRequired,
    view: PropTypes.string.isRequired,
  };

  constructor() {
    super();
    this.state = {
      view: 'table',
    };
  }

  getMenuItem = opt => {
    return (
      <MenuItem
        key={opt.id}
        onSelect={this.props.handleChange}
        eventKey={opt.id}
        isActive={opt.id === this.props.view}
      >
        {opt.name}
      </MenuItem>
    );
  };

  render() {
    const {options} = this.props;
    let dropdownTitle = <Title>{t('Views')}</Title>;

    if (options.length > 1) {
      return (
        <DropdownLink btnGroup={true} title={dropdownTitle}>
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

export default ViewsDropdown;
