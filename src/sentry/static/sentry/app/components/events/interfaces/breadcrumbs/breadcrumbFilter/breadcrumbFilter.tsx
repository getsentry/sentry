import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {IconProps} from 'app/types/iconProps';
import {t} from 'app/locale';
import space from 'app/styles/space';
import DropdownControl from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

import BreadcrumbFilterHeader from './breadcrumbFilterHeader';
import BreadcrumbFilterFooter from './breadcrumbFilterFooter';
import {BreadcrumbDetails, BreadcrumbType} from '../types';
import {BreadCrumbIconWrapper} from '../styles';

type FilterData = {
  type: BreadcrumbType;
  isChecked: boolean;
} & BreadcrumbDetails;

type Props = {
  onFilter: (filterData: Array<FilterData>) => () => void;
  filterData: Array<FilterData>;
};

type State = {
  filterData: Array<FilterData>;
};

class BreadcrumbFilter extends React.Component<Props, State> {
  state = {
    filterData: this.props.filterData,
  };

  componentDidMount() {
    this.loadState();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.filterData, this.props.filterData)) {
      this.loadState();
    }
  }

  loadState = () => {
    const {filterData} = this.props;
    this.setState({
      filterData,
    });
  };

  handleClickItem = (breadcrumbType: BreadcrumbType) => (
    event: React.MouseEvent<HTMLLIElement>
  ) => {
    event.stopPropagation();

    const {filterData} = this.state;

    const newFilterData = filterData.map(data => {
      if (data.type === breadcrumbType) {
        return {
          ...data,
          isChecked: !data.isChecked,
        };
      }
      return data;
    });

    this.setState({
      filterData: newFilterData,
    });
  };

  handleSelectAll = (selectAll: boolean) => {
    this.setState(prevState => ({
      filterData: prevState.filterData.map(data => ({
        ...data,
        isChecked: selectAll,
      })),
    }));
  };

  render() {
    const {onFilter} = this.props;
    const {filterData} = this.state;

    const selectedQuantity = filterData.filter(data => data.isChecked).length;

    return (
      <Wrapper>
        <DropdownControl
          menuWidth="10vw"
          blendWithActor
          button={({isOpen, getActorProps}) => (
            <StyledDropdownButton {...getActorProps()} isOpen={isOpen}>
              {t('Custom Search')}
            </StyledDropdownButton>
          )}
        >
          <React.Fragment>
            <BreadcrumbFilterHeader
              onSelectAll={this.handleSelectAll}
              selectedQuantity={selectedQuantity}
              isAllSelected={filterData.length === selectedQuantity}
            />
            <List>
              {filterData.map(
                ({type, icon, color, borderColor, description, isChecked}) => {
                  const Icon = icon as React.ComponentType<IconProps>;
                  return (
                    <ListItem
                      key={type}
                      isChecked={isChecked}
                      onClick={this.handleClickItem(type)}
                    >
                      <BreadCrumbIconWrapper
                        color={color}
                        borderColor={borderColor}
                        size={20}
                      >
                        <Icon size="xs" />
                      </BreadCrumbIconWrapper>
                      <span>{description}</span>
                      <CheckboxFancy isChecked={isChecked} />
                    </ListItem>
                  );
                }
              )}
            </List>
            {!isEqual(this.props.filterData, filterData) && (
              <BreadcrumbFilterFooter onSubmit={onFilter(filterData)} />
            )}
          </React.Fragment>
        </DropdownControl>
      </Wrapper>
    );
  }
}

export default BreadcrumbFilter;

const StyledDropdownButton = styled(DropdownButton)`
  max-width: 200px;
`;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 20px 1fr 16px;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)};
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeMedium};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  border-top: 1px solid ${p => p.theme.borderLight};
  margin-top: -1px;
  :hover {
    background-color: ${p => p.theme.offWhite};
  }
  :last-child {
    border-bottom: 0;
  }
`;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;
