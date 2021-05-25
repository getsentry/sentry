import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {Content} from 'app/components/dropdownControl';
import {IconFilter} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

export type RenderProps = {
  toggleFilter: (filter: string) => void;
};

type RenderFunc = (
  props: RenderProps
) => Array<{id: string; label: string; items: React.ReactElement}>;

type Props = {
  header: React.ReactElement;
  onFilterChange: (filterSelection: Set<string>) => void;
  filterList: string[];
  children: RenderFunc;
  selection: Set<string>;
};

class Filter extends Component<Props> {
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

  toggleSection = (sectionId: string) => {
    const {filterList, onFilterChange} = this.props;
    const sectionList = filterList.filter(id => id.startsWith(sectionId));
    const newSelection = new Set(sectionList);

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
        <Fragment>
          <IconFilter size="xs" />
          <FilterLabel>{t('Filter')}</FilterLabel>
        </Fragment>
      ),
      priority: 'default',
      hasDarkBorderBottomColor: false,
    };

    if (checkedQuantity > 0) {
      dropDownButtonProps.children = (
        <span>{tn('%s Active Filter', '%s Active Filters', checkedQuantity)}</span>
      );
      dropDownButtonProps.hasDarkBorderBottomColor = true;
    }
    return (
      <DropdownControl
        menuWidth="240px"
        blendWithActor
        alwaysRenderMenu={false}
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
        {({isOpen, getMenuProps}) => (
          <MenuContent
            {...getMenuProps()}
            isOpen={isOpen}
            blendCorner
            alignMenu="left"
            width="240px"
          >
            {isOpen && (
              <Fragment>
                {header}

                {children({toggleFilter: this.toggleFilter}).map(({id, label, items}) => (
                  <Fragment key={id}>
                    <Header>
                      <span>{label}</span>
                      <CheckboxFancy
                        isChecked={checkedQuantity > 0}
                        isIndeterminate={
                          checkedQuantity > 0 && checkedQuantity !== filterList.length
                        }
                        onClick={event => {
                          event.stopPropagation();
                          this.toggleSection(id);
                        }}
                      />
                    </Header>
                    {items}
                  </Fragment>
                ))}
              </Fragment>
            )}
          </MenuContent>
        )}
      </DropdownControl>
    );
  }
}

const MenuContent = styled(Content)`
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
`;

export default Filter;
