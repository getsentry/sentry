import React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl from 'app/components/dropdownControl';
import {IconFilter} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

export type RenderProps = {
  toggleFilter: (filter: string) => void;
};

type RenderFunc = (props: RenderProps) => React.ReactElement;

type Props = {
  header: string;
  onFilterChange: (filterSelection: Set<string>) => void;
  filterList: string[];
  children: RenderFunc;
  selection: Set<string>;
};

class Filter extends React.Component<Props> {
  toggleFilter = (filter: string) => {
    const {onFilterChange, selection} = this.props;
    const newSelection = new Set(selection);
    if (newSelection.has(filter)) {
      newSelection.delete(filter);
    } else {
      newSelection.add(filter);
    }
    onFilterChange(newSelection);
  };

  toggleAllFilters = () => {
    const {filterList, onFilterChange, selection} = this.props;
    const newSelection =
      selection.size === filterList.length ? new Set<string>() : new Set(filterList);

    onFilterChange(newSelection);
  };

  getNumberOfActiveFilters = (): number => {
    const {selection} = this.props;
    return selection.size;
  };

  render() {
    const {children, header, filterList} = this.props;
    const checkedQuantity = this.getNumberOfActiveFilters();

    const dropDownButtonProps: Pick<DropdownButtonProps, 'children' | 'priority'> & {
      hasDarkBorderBottomColor: boolean;
    } = {
      children: (
        <React.Fragment>
          <IconFilter size="xs" />
          <FilterLabel>{t('Filter')}</FilterLabel>
        </React.Fragment>
      ),
      priority: 'default',
      hasDarkBorderBottomColor: false,
    };

    if (checkedQuantity > 0) {
      dropDownButtonProps.children = (
        <span>{tn('%s Active Filter', '%s Active Filters', checkedQuantity)}</span>
      );
      dropDownButtonProps.priority = 'primary';
      dropDownButtonProps.hasDarkBorderBottomColor = true;
    }
    return (
      <DropdownControl
        menuWidth="240px"
        blendWithActor
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps()}
            showChevron={false}
            isOpen={isOpen}
            hasDarkBorderBottomColor={dropDownButtonProps.hasDarkBorderBottomColor}
            priority={dropDownButtonProps.priority as DropdownButtonProps['priority']}
            data-test-id="filter-button"
          >
            {dropDownButtonProps.children}
          </StyledDropdownButton>
        )}
      >
        <MenuContent>
          <Header>
            <span>{header}</span>
            <CheckboxFancy
              isChecked={checkedQuantity > 0}
              isIndeterminate={
                checkedQuantity > 0 && checkedQuantity !== filterList.length
              }
              onClick={event => {
                event.stopPropagation();
                this.toggleAllFilters();
              }}
            />
          </Header>
          {children({toggleFilter: this.toggleFilter})}
        </MenuContent>
      </DropdownControl>
    );
  }
}

const MenuContent = styled('div')`
  max-height: 250px;
  overflow-y: auto;
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: auto min-content;
  grid-column-gap: ${space(1)};
  align-items: center;

  margin: 0;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const FilterLabel = styled('span')`
  margin-left: ${space(1)};
`;

const StyledDropdownButton = styled(DropdownButton)<{hasDarkBorderBottomColor?: boolean}>`
  white-space: nowrap;
  max-width: 200px;

  z-index: ${p => p.theme.zIndex.dropdown};

  &:hover,
  &:active {
    ${p =>
      !p.isOpen &&
      p.hasDarkBorderBottomColor &&
      `
          border-bottom-color: ${p.theme.button.primary.border};
        `}
  }

  ${p =>
    !p.isOpen &&
    p.hasDarkBorderBottomColor &&
    `
      border-bottom-color: ${p.theme.button.primary.border};
    `}
`;

export default Filter;
