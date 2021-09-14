import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {Content} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

type DropdownSection = {
  id: string;
  label: string;
  items: Array<{label: string; value: string; checked: boolean; filtered: boolean}>;
};

type SectionProps = DropdownSection & {
  toggleFilter: (value: string) => void;
};

function FilterSection({label, items, toggleFilter}: SectionProps) {
  return (
    <Fragment>
      <Header>
        <span>{label}</span>
      </Header>
      {items
        .filter(item => !item.filtered)
        .map(item => (
          <ListItem
            key={item.value}
            isChecked={item.checked}
            onClick={() => {
              toggleFilter(item.value);
            }}
          >
            <TeamName>{item.label}</TeamName>
          </ListItem>
        ))}
    </Fragment>
  );
}

type Props = {
  header: React.ReactElement;
  onFilterChange: (selectedValue: string) => void;
  dropdownSection: DropdownSection;
};

class Filter extends Component<Props> {
  toggleFilter = (value: string) => {
    const {onFilterChange} = this.props;
    onFilterChange(value);
  };

  render() {
    const {dropdownSection, header} = this.props;
    const selected = this.props.dropdownSection.items.find(item => item.checked);

    const dropDownButtonProps: Pick<DropdownButtonProps, 'children' | 'priority'> & {
      hasDarkBorderBottomColor: boolean;
    } = {
      priority: 'default',
      hasDarkBorderBottomColor: false,
    };

    return (
      <DropdownControl
        menuWidth="240px"
        blendWithActor
        alwaysRenderMenu={false}
        button={({isOpen, getActorProps}) => (
          <StyledDropdownButton
            {...getActorProps()}
            isOpen={isOpen}
            hasDarkBorderBottomColor={dropDownButtonProps.hasDarkBorderBottomColor}
            priority={dropDownButtonProps.priority as DropdownButtonProps['priority']}
            data-test-id="filter-button"
          >
            {t('Team: ')}
            {selected?.label}
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
              <FilterSection {...dropdownSection} toggleFilter={this.toggleFilter} />
            </List>
          </MenuContent>
        )}
      </DropdownControl>
    );
  }
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

const StyledDropdownButton = styled(DropdownButton)<{hasDarkBorderBottomColor?: boolean}>`
  white-space: nowrap;
  max-width: 200px;
  height: 42px;

  z-index: ${p => p.theme.zIndex.dropdown};
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
  cursor: pointer;
  :hover {
    background-color: ${p => p.theme.backgroundSecondary};
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
