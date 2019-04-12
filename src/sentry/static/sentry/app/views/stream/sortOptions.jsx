import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';
import space from 'app/styles/space';

class SortOptions extends React.PureComponent {
  static propTypes = {
    sort: PropTypes.string,
    onSelect: PropTypes.func,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      sortKey: this.props.sort || 'date',
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      sortKey: nextProps.sort || 'date',
    });
  }

  getMenuItem = key => {
    return (
      <StyledMenuItem
        onSelect={this.onSelect}
        eventKey={key}
        isActive={this.state.sortKey === key}
      >
        {this.getSortLabel(key)}
      </StyledMenuItem>
    );
  };

  onSelect = sort => {
    this.setState({sortKey: sort});
    if (this.props.onSelect) {
      this.props.onSelect(sort);
    }
  };

  getSortLabel = key => {
    switch (key) {
      case 'new':
        return t('First Seen');
      case 'priority':
        return t('Priority');
      case 'freq':
        return t('Frequency');
      case 'date':
      default:
        return t('Last Seen');
    }
  };

  render() {
    return (
      <Container>
        <DropdownMenu>
          {({isOpen, getMenuProps, getActorProps}) => {
            return (
              <React.Fragment>
                <StyledDropdownButton
                  {...getActorProps({isStyled: true})}
                  isOpen={isOpen}
                >
                  <em>{t('Sort by')}: &nbsp; </em>
                  {this.getSortLabel(this.state.sortKey)}
                </StyledDropdownButton>
                <MenuContainer {...getMenuProps({isStyled: true})} isOpen={isOpen}>
                  {this.getMenuItem('priority')}
                  {this.getMenuItem('date')}
                  {this.getMenuItem('new')}
                  {this.getMenuItem('freq')}
                </MenuContainer>
              </React.Fragment>
            );
          }}
        </DropdownMenu>
      </Container>
    );
  }
}

const Container = styled.div`
  position: relative;
  margin-right: ${space(0.5)};
`;

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
  font-weight: normal;

  /* Hack but search input, and sort dropdown are not standard size buttons yet */
  height: 38px;
  & > span {
    padding: 11px 16px;
    font-size: ${p => p.theme.fontSizeMedium};
  }
  & em {
    font-style: normal;
    color: ${p => p.theme.gray2};
  }
`;

const StyledMenuItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  & a {
    color: ${p => p.theme.foreground};
    display: block;
    padding: ${space(0.5)} ${space(2)};
  }
  & a:hover {
    background: ${p => p.theme.offWhite};
  }
  &.active a,
  &.active a:hover {
    color: ${p => p.theme.white};
    background: ${p => p.theme.purple};
  }
`;

const MenuContainer = styled.ul`
  list-style: none;
  width: 100%;

  position: absolute;
  /* Buttons are 38px tall, this has to be -1 to get button overlapping the menu */
  top: 37px;
  padding: 0 0 ${space(0.5)} 0;
  margin: 0;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  background: ${p => p.theme.background};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  box-shadow: 0 1px 3px rgba(70, 82, 98, 0.25);
  border: 1px solid ${p => p.theme.borderDark};
  background-clip: padding-box;

  display: ${p => (p.isOpen ? 'block' : 'none')};
`;

export default SortOptions;
