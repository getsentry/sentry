import {Fragment} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl, {Content} from 'sentry/components/dropdownControl';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

type Props = {
  header: React.ReactElement;
  items: Array<{checked: boolean; filtered: boolean; label: string; value: string}>;
  onFilterChange: (filterSelection: Set<string>) => void;
  fullWidth?: boolean;
  showMyTeamsDescription?: boolean;
};

function Filter({
  onFilterChange,
  header,
  items,
  showMyTeamsDescription,
  fullWidth = false,
}: Props) {
  function toggleFilter(value: string) {
    const newSelection = new Set(
      items.filter(item => item.checked).map(item => item.value)
    );
    if (newSelection.has(value)) {
      newSelection.delete(value);
    } else {
      newSelection.add(value);
    }
    onFilterChange(newSelection);
  }

  function getActiveFilters() {
    return items.filter(item => item.checked);
  }

  const activeFilters = getActiveFilters();

  let filterDescription = showMyTeamsDescription ? t('My Teams') : t('All Teams');
  if (activeFilters.length > 0) {
    filterDescription = activeFilters[0].label;
  }

  return (
    <DropdownControl
      menuWidth="240px"
      fullWidth={fullWidth}
      alwaysRenderMenu={false}
      button={({isOpen, getActorProps}) => (
        <StyledDropdownButton
          {...getActorProps()}
          isOpen={isOpen}
          icon={<IconUser />}
          priority="default"
          data-test-id="filter-button"
          fullWidth={fullWidth}
          rightAlignChevron={fullWidth}
          detached
        >
          <DropdownButtonText fullWidth={fullWidth}>
            {filterDescription}
          </DropdownButtonText>
          {activeFilters.length > 1 && (
            <StyledBadge text={`+${activeFilters.length - 1}`} />
          )}
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
          detached
        >
          <List>
            {header}
            <Fragment>
              {items
                .filter(item => !item.filtered)
                .map(item => (
                  <ListItem
                    key={item.value}
                    isChecked={item.checked}
                    onClick={event => {
                      event.stopPropagation();
                      toggleFilter(item.value);
                    }}
                  >
                    <TeamName>{item.label}</TeamName>
                    <CheckboxFancy isChecked={item.checked} />
                  </ListItem>
                ))}
            </Fragment>
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

const StyledDropdownButton = styled(DropdownButton)<{fullWidth: boolean}>`
  white-space: nowrap;
  display: flex;
  align-items: center;

  z-index: ${p => p.theme.zIndex.dropdown};

  ${p =>
    p.fullWidth
      ? `
      width: 100%
  `
      : `max-width: 200px`}
`;

const DropdownButtonText = styled('span')<{fullWidth: boolean}>`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  flex: 1;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    text-align: ${p => p.fullWidth && 'start'};
  }
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
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
