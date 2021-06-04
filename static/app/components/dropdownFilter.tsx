import {ChangeEvent, ComponentProps, Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {Content} from 'app/components/dropdownControl';
import Input from 'app/components/forms/input';
import {IconFilter} from 'app/icons';
import {t, tn} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

type DropdownControlProps = ComponentProps<typeof DropdownControl>;
type MenuProps = ComponentProps<typeof Content>;

type FilterOption = {
  value: string;
  label: string;
};

type Props = {
  alignContent: MenuProps['alignMenu'];
  contentWidth: MenuProps['width'];
  menuWidth: DropdownControlProps['menuWidth'];
  headerLabel: ReactNode;
  /**
   * The set of selected option values.
   */
  selection: Set<string>;
  /**
   * The options available in this dropdown.
   */
  options: FilterOption[];
  /**
   * Options that are pinned to the top of the list. Search does not affect
   * these options.
   */
  pinnedOptions?: FilterOption[];
  /**
   * The callback for when the selection changes
   */
  onSelectionChange?: (selection: Set<string>) => void;
  /**
   * Enables the search within the dropdown
   */
  enableSearch?: boolean;
  /**
   * The placeholder string to use for the search. This is only used
   * when `enableSearch` is `true`.
   */
  searchPlaceholder?: string;
};

function DropdownFilter({
  alignContent,
  contentWidth,
  menuWidth,
  headerLabel,
  selection,
  options,
  pinnedOptions,
  onSelectionChange,
  searchPlaceholder,
}: Props) {
  const [filter, setFilter] = useState('');

  const updateSelection = newSelection => {
    onSelectionChange?.(newSelection);
  };

  const hasChecked = selection.size > 0;

  const searchFilter = filter.toLowerCase();
  const allOptions = !pinnedOptions
    ? options
    : [
        // make sure the `pinnedOptions` are on top
        ...pinnedOptions,
        // only apply the search to the `options` and NOT `pinnedOptions`
        ...options.filter(({label}) =>
          searchFilter ? label.toLowerCase().includes(searchFilter) : true
        ),
      ];

  return (
    <DropdownControl
      menuWidth={menuWidth}
      blendWithActor
      alwaysRenderMenu={false}
      button={({isOpen, getActorProps}) => (
        <StyledDropdownButton
          {...getActorProps()}
          showChevron={false}
          isOpen={isOpen}
          hasDarkBorderBottomColor={hasChecked}
          priority={hasChecked ? 'primary' : 'default'}
          data-test-id="filter-button"
        >
          {hasChecked ? (
            <span>{tn('%s Active Filter', '%s Active Filters', selection.size)}</span>
          ) : (
            <Fragment>
              <IconFilter size="xs" />
              <FilterLabel>{t('Filter')}</FilterLabel>
            </Fragment>
          )}
        </StyledDropdownButton>
      )}
    >
      {({isOpen, getMenuProps}) => (
        <MenuContent
          {...getMenuProps()}
          isOpen={isOpen}
          blendCorner
          alignMenu={alignContent}
          width={contentWidth}
        >
          {isOpen && (
            <Fragment>
              <StyledInput
                autoFocus
                placeholder={searchPlaceholder}
                onClick={event => event.stopPropagation()}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFilter(event.target.value)
                }
                value={filter || ''}
              />
              <Header>
                <span>{headerLabel}</span>
                <CheckboxFancy
                  isChecked={selection.size > 0}
                  isIndeterminate={
                    selection.size > 0 && selection.size !== allOptions.length
                  }
                  onClick={event => {
                    event.stopPropagation();
                    const newSelection: Set<string> =
                      selection.size === allOptions.length
                        ? new Set()
                        : new Set(allOptions.map(({value}) => value));
                    updateSelection(newSelection);
                  }}
                />
              </Header>
              <List>
                {allOptions.map(({value, label}) => (
                  <ListItem
                    key={value}
                    isChecked={selection.has(value)}
                    onClick={event => {
                      event.stopPropagation();
                      const newSelection = new Set(selection);
                      if (newSelection.has(value)) {
                        newSelection.delete(value);
                      } else {
                        newSelection.add(value);
                      }
                      updateSelection(newSelection);
                    }}
                  >
                    <OptionName>{label}</OptionName>
                    <CheckboxFancy isChecked={selection.has(value)} />
                  </ListItem>
                ))}
              </List>
            </Fragment>
          )}
        </MenuContent>
      )}
    </DropdownControl>
  );
}

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

const StyledInput = styled(Input)`
  border: none;
  border-bottom: 1px solid ${p => p.theme.gray200};
  border-radius: 0;
`;

const FilterLabel = styled('span')`
  margin-left: ${space(1)};
`;

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

const List = styled('ul')`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const ListItem = styled('li')<{isChecked?: boolean}>`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }

  &:hover span {
    color: ${p => p.theme.blue300};
    text-decoration: underline;
  }
`;

const OptionName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${overflowEllipsis};
`;

export default DropdownFilter;
