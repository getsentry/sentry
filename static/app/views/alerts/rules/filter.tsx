import {Fragment} from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl, {Content} from 'sentry/components/dropdownControl';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

type DropdownSection = {
  id: string;
  items: Array<{checked: boolean; filtered: boolean; label: string; value: string}>;
  label: string;
};

type SectionProps = DropdownSection & {
  toggleFilter: (section: string, value: string) => void;
  toggleSection: (id: string) => void;
};

function FilterSection({id, label, items, toggleSection, toggleFilter}: SectionProps) {
  const checkedItemsCount = items.filter(item => item.checked).length;
  return (
    <Fragment>
      <Header>
        <span>{label}</span>
        <CheckboxFancy
          isChecked={checkedItemsCount === items.length}
          isIndeterminate={checkedItemsCount > 0 && checkedItemsCount !== items.length}
          onClick={event => {
            event.stopPropagation();
            toggleSection(id);
          }}
        />
      </Header>
      {items
        .filter(item => !item.filtered)
        .map(item => (
          <ListItem
            key={item.value}
            isChecked={item.checked}
            onClick={event => {
              event.stopPropagation();
              toggleFilter(id, item.value);
            }}
          >
            <TeamName>{item.label}</TeamName>
            <CheckboxFancy isChecked={item.checked} />
          </ListItem>
        ))}
    </Fragment>
  );
}

type Props = {
  dropdownSections: DropdownSection[];
  header: React.ReactElement;
  onFilterChange: (section: string, filterSelection: Set<string>) => void;
};

function Filter({onFilterChange, header, dropdownSections}: Props) {
  function toggleFilter(sectionId: string, value: string) {
    const section = dropdownSections.find(
      dropdownSection => dropdownSection.id === sectionId
    )!;
    const newSelection = new Set(
      section.items.filter(item => item.checked).map(item => item.value)
    );
    if (newSelection.has(value)) {
      newSelection.delete(value);
    } else {
      newSelection.add(value);
    }
    onFilterChange(sectionId, newSelection);
  }

  function toggleSection(sectionId: string) {
    const section = dropdownSections.find(
      dropdownSection => dropdownSection.id === sectionId
    )!;
    const activeItems = section.items.filter(item => item.checked);

    const newSelection =
      section.items.length === activeItems.length
        ? new Set<string>()
        : new Set(section.items.map(item => item.value));

    onFilterChange(sectionId, newSelection);
  }

  function getActiveFilters() {
    return dropdownSections
      .map(section => section.items)
      .flat()
      .filter(item => item.checked);
  }

  const activeFilters = getActiveFilters();

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
          icon={<IconUser />}
          priority="default"
          data-test-id="filter-button"
        >
          <DropdownButtonText>
            {activeFilters.length > 0
              ? activeFilters.map(filter => filter.label).join(', ')
              : t('All Teams')}
          </DropdownButtonText>
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
          <List>
            {header}
            {dropdownSections.map(section => (
              <FilterSection
                key={section.id}
                {...section}
                toggleSection={toggleSection}
                toggleFilter={toggleFilter}
              />
            ))}
          </List>
        </MenuContent>
      )}
    </DropdownControl>
  );
}

const MenuContent = styled(Content)`
  max-height: 290px;
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

const StyledDropdownButton = styled(DropdownButton)`
  white-space: nowrap;
  max-width: 200px;

  z-index: ${p => p.theme.zIndex.dropdown};
`;

const DropdownButtonText = styled('span')`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  flex: 1;
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

const TeamName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${overflowEllipsis};
`;

export default Filter;
