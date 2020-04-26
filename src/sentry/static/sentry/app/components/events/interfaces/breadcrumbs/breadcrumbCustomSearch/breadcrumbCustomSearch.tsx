import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {IconProps} from 'app/types/iconProps';
import {t} from 'app/locale';
import space from 'app/styles/space';
import DropdownControl from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

import BreadcrumbFilterHeader from './breadcrumbCustomSearchHeader';
import BreadcrumbFilterFooter from './breadcrumbCustomSearchFooter';
import {BreadcrumbDetails, BreadcrumbType} from '../types';
import {BreadCrumbIconWrapper} from '../styles';

type CustomSearchData = {
  id: number;
  type: BreadcrumbType;
  isChecked: boolean;
} & BreadcrumbDetails;

type Props = {
  onFilter: (filterData: Array<CustomSearchData>) => () => void;
  customSearchData: Array<CustomSearchData>;
};

type State = {
  customSearchData: Array<CustomSearchData>;
};

class BreadcrumbCustomSearch extends React.Component<Props, State> {
  state = {
    customSearchData: this.props.customSearchData,
  };

  componentDidMount() {
    this.loadState();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(prevProps.customSearchData, this.props.customSearchData)) {
      this.loadState();
    }
  }

  loadState = () => {
    const {customSearchData} = this.props;
    this.setState({
      customSearchData,
    });
  };

  handleClickItem = (breadcrumbType: BreadcrumbType) => (
    event: React.MouseEvent<HTMLLIElement>
  ) => {
    event.stopPropagation();

    const {customSearchData} = this.state;
    const newFilterData = customSearchData.map(data => {
      if (data.type === breadcrumbType) {
        return {
          ...data,
          isChecked: !data.isChecked,
        };
      }
      return data;
    });

    this.setState({
      customSearchData: newFilterData,
    });
  };

  handleSelectAll = (selectAll: boolean) => {
    this.setState(prevState => ({
      customSearchData: prevState.customSearchData.map(data => ({
        ...data,
        isChecked: selectAll,
      })),
    }));
  };

  render() {
    const {onFilter} = this.props;
    const {customSearchData} = this.state;

    const selectedQuantity = customSearchData.filter(data => data.isChecked).length;

    return (
      <Wrapper>
        <DropdownControl
          menuWidth="50vh"
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
              isAllSelected={customSearchData.length === selectedQuantity}
            />
            <List>
              {customSearchData.map(
                ({type, icon, color, borderColor, description, isChecked}) => {
                  const Icon = icon as React.ComponentType<IconProps>;
                  return (
                    <ListItem
                      key={type}
                      isChecked={isChecked}
                      onClick={this.handleClickItem(type)}
                    >
                      <ListItemDescription>
                        <BreadCrumbIconWrapper
                          color={color}
                          borderColor={borderColor}
                          size={20}
                        >
                          <Icon size="xs" />
                        </BreadCrumbIconWrapper>
                        <span>{description}</span>
                      </ListItemDescription>
                      <CheckboxFancy isChecked={isChecked} />
                    </ListItem>
                  );
                }
              )}
            </List>
            {!isEqual(this.props.customSearchData, customSearchData) && (
              <BreadcrumbFilterFooter onSubmit={onFilter(customSearchData)} />
            )}
          </React.Fragment>
        </DropdownControl>
      </Wrapper>
    );
  }
}

export default BreadcrumbCustomSearch;

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
`;

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 1fr 16px;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  cursor: pointer;
  :hover {
    background-color: ${p => p.theme.offWhite};
  }
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }

  &:hover span {
    color: ${p => p.theme.blue};
    text-decoration: underline;
  }
`;

const Wrapper = styled('div')`
  position: relative;
  display: flex;
`;

const ListItemDescription = styled('div')`
  display: grid;
  grid-template-columns: 20px 1fr;
  grid-column-gap: ${space(1)};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;
