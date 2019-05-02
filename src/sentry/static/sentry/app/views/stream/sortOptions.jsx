import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import DropdownControl from 'app/components/dropdownControl';
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
        <DropdownControl
          label={
            <React.Fragment>
              <LabelText>{t('Sort by')}: &nbsp; </LabelText>
              {this.getSortLabel(this.state.sortKey)}
            </React.Fragment>
          }
        >
          {this.getMenuItem('priority')}
          {this.getMenuItem('date')}
          {this.getMenuItem('new')}
          {this.getMenuItem('freq')}
        </DropdownControl>
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-right: ${space(0.5)};
`;

const LabelText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray2};
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

export default SortOptions;
