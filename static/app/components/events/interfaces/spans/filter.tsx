import * as React from 'react';
import styled from '@emotion/styled';

import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl from 'sentry/components/dropdownControl';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

type NoFilter = {
  type: 'no_filter';
};

export type ActiveFilter = {
  operationNames: Set<string>;
  type: 'active_filter';
};

export const noFilter: NoFilter = {
  type: 'no_filter',
};

export type ActiveOperationFilter = NoFilter | ActiveFilter;

type Props = {
  operationNameCounts: Map<string, number>;
  operationNameFilter: ActiveOperationFilter;
  toggleAllOperationNameFilters: () => void;
  toggleOperationNameFilter: (operationName: string) => void;
};

class Filter extends React.Component<Props> {
  isOperationNameActive(operationName: string) {
    const {operationNameFilter} = this.props;

    if (operationNameFilter.type === 'no_filter') {
      return false;
    }

    // invariant: operationNameFilter.type === 'active_filter'

    return operationNameFilter.operationNames.has(operationName);
  }

  getNumberOfActiveFilters(): number {
    const {operationNameFilter} = this.props;

    if (operationNameFilter.type === 'no_filter') {
      return 0;
    }

    return operationNameFilter.operationNames.size;
  }

  render() {
    const {operationNameCounts} = this.props;

    if (operationNameCounts.size === 0) {
      return null;
    }

    const checkedQuantity = this.getNumberOfActiveFilters();

    const dropDownButtonProps: Pick<DropdownButtonProps, 'children' | 'priority'> & {
      hasDarkBorderBottomColor: boolean;
    } = {
      children: (
        <React.Fragment>
          <IconFilter />
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
      <Wrapper data-test-id="op-filter-dropdown">
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
          <MenuContent
            onClick={event => {
              // propagated clicks will dismiss the menu; we stop this here
              event.stopPropagation();
            }}
          >
            <Header>
              <span>{t('Operation')}</span>
              <CheckboxFancy
                isChecked={checkedQuantity > 0}
                isIndeterminate={
                  checkedQuantity > 0 && checkedQuantity !== operationNameCounts.size
                }
                onClick={event => {
                  event.stopPropagation();
                  this.props.toggleAllOperationNameFilters();
                }}
              />
            </Header>
            <List>
              {Array.from(operationNameCounts, ([operationName, operationCount]) => {
                const isActive = this.isOperationNameActive(operationName);

                return (
                  <ListItem key={operationName} isChecked={isActive}>
                    <OperationDot backgroundColor={pickBarColor(operationName)} />
                    <OperationName>{operationName}</OperationName>
                    <OperationCount>{operationCount}</OperationCount>
                    <CheckboxFancy
                      isChecked={isActive}
                      onClick={event => {
                        event.stopPropagation();
                        this.props.toggleOperationNameFilter(operationName);
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </MenuContent>
        </DropdownControl>
      </Wrapper>
    );
  }
}

const FilterLabel = styled('span')`
  margin-left: ${space(1)};
`;

const Wrapper = styled('div')`
  position: relative;
  display: flex;

  margin-right: ${space(1)};
`;

const StyledDropdownButton = styled(DropdownButton)<{hasDarkBorderBottomColor?: boolean}>`
  white-space: nowrap;
  max-width: 200px;

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

const MenuContent = styled('div')`
  max-height: 250px;
  overflow-y: auto;
  border-top: 1px solid ${p => p.theme.gray200};
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
  grid-template-columns: max-content 1fr max-content max-content;
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

const OperationDot = styled('div')<{backgroundColor: string}>`
  content: '';
  display: block;
  width: 8px;
  min-width: 8px;
  height: 8px;
  margin-right: ${space(1)};
  border-radius: 100%;

  background-color: ${p => p.backgroundColor};
`;

const OperationName = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  ${overflowEllipsis};
`;

const OperationCount = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export function toggleFilter(
  previousState: ActiveOperationFilter,
  operationName: string
): ActiveOperationFilter {
  if (previousState.type === 'no_filter') {
    return {
      type: 'active_filter',
      operationNames: new Set([operationName]),
    };
  }

  // invariant: previousState.type === 'active_filter'
  // invariant: previousState.operationNames.size >= 1

  const {operationNames} = previousState;

  if (operationNames.has(operationName)) {
    operationNames.delete(operationName);
  } else {
    operationNames.add(operationName);
  }

  if (operationNames.size > 0) {
    return {
      type: 'active_filter',
      operationNames,
    };
  }

  return {
    type: 'no_filter',
  };
}

export function toggleAllFilters(
  previousState: ActiveOperationFilter,
  operationNames: string[]
): ActiveOperationFilter {
  if (previousState.type === 'no_filter') {
    return {
      type: 'active_filter',
      operationNames: new Set(operationNames),
    };
  }

  // invariant: previousState.type === 'active_filter'

  if (previousState.operationNames.size === operationNames.length) {
    // all filters were selected, so the next state should un-select all filters
    return {
      type: 'no_filter',
    };
  }

  // not all filters were selected, so the next state is to select all the remaining filters
  return {
    type: 'active_filter',
    operationNames: new Set(operationNames),
  };
}

export default Filter;
