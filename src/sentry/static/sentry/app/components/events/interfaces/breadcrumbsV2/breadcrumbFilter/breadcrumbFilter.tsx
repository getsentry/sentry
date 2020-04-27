import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import {css} from '@emotion/core';

import {t, tn} from 'app/locale';
import DropdownControl from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';

import BreadcrumbFilterGroup from './breadcrumbFilterGroup';
import BreadcrumbFilterHeader from './breadcrumbFilterHeader';
import BreadcrumbFilterFooter from './breadcrumbFilterFooter';
import {FilterGroup, FilterGroupType, FilterType} from './types';

type Props = {
  onFilter: (filterGroups: Array<FilterGroup>) => () => void;
  filterGroups: Array<FilterGroup>;
};

type State = {
  filterGroups: Array<FilterGroup>;
  checkedOptionsQuantity: number;
};

class BreadcrumbFilter extends React.Component<Props, State> {
  state: State = {
    filterGroups: [],
    checkedOptionsQuantity: 0,
  };

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(this.props.filterGroups, prevProps.filterGroups)) {
      this.loadState();
    }
  }

  setCheckedOptionsQuantity = () => {
    this.setState(prevState => ({
      checkedOptionsQuantity: prevState.filterGroups.filter(
        filterGroup => filterGroup.isChecked
      ).length,
    }));
  };

  loadState() {
    const {filterGroups} = this.props;
    this.setState(
      {
        filterGroups,
      },
      this.setCheckedOptionsQuantity
    );
  }

  handleClickItem = (type: FilterType, groupType: FilterGroupType) => {
    this.setState(
      prevState => ({
        filterGroups: prevState.filterGroups.map(filterGroup => {
          if (filterGroup.groupType === groupType && filterGroup.type === type) {
            return {
              ...filterGroup,
              isChecked: !filterGroup.isChecked,
            };
          }
          return filterGroup;
        }),
      }),
      this.setCheckedOptionsQuantity
    );
  };

  handleSelectAll = (selectAll: boolean) => {
    this.setState(
      prevState => ({
        filterGroups: prevState.filterGroups.map(data => ({
          ...data,
          isChecked: selectAll,
        })),
      }),
      this.setCheckedOptionsQuantity
    );
  };

  getDropDownButton = ({isOpen, getActorProps}) => {
    const {checkedOptionsQuantity} = this.state;

    let buttonLabel = t('Filter By');
    let buttonPriority = 'default';

    if (checkedOptionsQuantity > 0) {
      buttonLabel = tn('%s Active Filter', '%s Active Filters', checkedOptionsQuantity);
      buttonPriority = 'primary';
    }

    return (
      <StyledDropdownButton
        {...getActorProps()}
        isOpen={isOpen}
        size="small"
        priority={buttonPriority}
      >
        {buttonLabel}
      </StyledDropdownButton>
    );
  };

  render() {
    const {onFilter} = this.props;
    const {filterGroups, checkedOptionsQuantity} = this.state;

    const hasFilterGroupsGroupTypeLevel = filterGroups.find(
      filterGroup => filterGroup.groupType === FilterGroupType.LEVEl
    );

    return (
      <Wrapper>
        <DropdownControl menuWidth="20vh" blendWithActor button={this.getDropDownButton}>
          <React.Fragment>
            <BreadcrumbFilterHeader
              onSelectAll={this.handleSelectAll}
              selectedQuantity={checkedOptionsQuantity}
              isAllSelected={filterGroups.length === checkedOptionsQuantity}
            />
            <BreadcrumbFilterGroup
              groupHeaderTitle={t('Type')}
              onClick={this.handleClickItem}
              data={filterGroups.filter(
                filterGroup => filterGroup.groupType === FilterGroupType.TYPE
              )}
            />
            {hasFilterGroupsGroupTypeLevel && (
              <BreadcrumbFilterGroup
                groupHeaderTitle={t('Level')}
                onClick={this.handleClickItem}
                data={filterGroups.filter(
                  filterGroup => filterGroup.groupType === FilterGroupType.LEVEl
                )}
              />
            )}
            {!isEqual(this.props.filterGroups, filterGroups) && (
              <BreadcrumbFilterFooter onSubmit={onFilter(filterGroups)} />
            )}
          </React.Fragment>
        </DropdownControl>
      </Wrapper>
    );
  }
}

export default BreadcrumbFilter;

const StyledDropdownButton = styled(DropdownButton)`
  border-right: 0;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  border-radius: ${p =>
    p.isOpen
      ? `${p.theme.borderRadius} 0 0 0`
      : `${p.theme.borderRadius} 0 0 ${p.theme.borderRadius}`};
  white-space: nowrap;
  max-width: 200px;
  &:hover,
  &:active {
    border-right: 0;
  }
  ${p =>
    !p.isOpen &&
    css`
      border-bottom-color: ${p.theme.button.primary.border};
    `}
`;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;
