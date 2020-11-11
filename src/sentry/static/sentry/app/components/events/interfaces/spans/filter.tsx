import React from 'react';
import styled from '@emotion/styled';

import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {IconFilter} from 'app/icons';
import DropdownControl from 'app/components/dropdownControl';
import DropdownButton from 'app/components/dropdownButton';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import {pickSpanBarColour} from 'app/components/events/interfaces/spans/utils';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import {ParsedTraceType} from './types';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

type NoFilter = {
  type: 'no_filter';
};

type ActiveFilter = {
  type: 'active_filter';
  operationNames: Set<string>;
};

export const noFilter: NoFilter = {
  type: 'no_filter',
};

export type ActiveOperationFilter = NoFilter | ActiveFilter;

type Props = {
  parsedTrace: ParsedTraceType;
  operationNameFilter: ActiveOperationFilter;
  toggleOperationNameFilter: (operationName: string) => void;
  toggleAllOperationNameFilters: (operationNames: string[]) => void;
};

class Filter extends React.Component<Props> {
  getOperationNames(): string[] {
    const {parsedTrace} = this.props;

    const result = parsedTrace.spans.reduce(
      (operationNames: string[], span) => {
        const operationName = span.op;

        if (typeof operationName === 'string' && operationName.length > 0) {
          if (!operationNames.includes(operationName)) {
            operationNames.push(operationName);
          }
        }

        return operationNames;
      },
      [parsedTrace.op]
    );

    // sort alphabetically using case insensitive comparison
    result.sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));

    return result;
  }

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
    const operationNames = this.getOperationNames();

    if (operationNames.length === 0) {
      return null;
    }

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
                  checkedQuantity > 0 && checkedQuantity !== operationNames.length
                }
                onClick={event => {
                  event.stopPropagation();
                  this.props.toggleAllOperationNameFilters(operationNames);
                }}
              />
            </Header>
            <List>
              {operationNames.map((operationName: string) => {
                const isActive = this.isOperationNameActive(operationName);

                return (
                  <ListItem key={operationName} isChecked={isActive}>
                    <OperationDot backgroundColor={pickSpanBarColour(operationName)} />
                    <OperationName>{operationName}</OperationName>
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
  grid-template-columns: max-content 1fr max-content;
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
