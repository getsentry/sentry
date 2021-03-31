import React from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'app/components/dropdownButton';
import DropdownControl from 'app/components/dropdownControl';
import {pickSpanBarColour} from 'app/components/events/interfaces/spans/utils';
import Radio from 'app/components/radio';
import {IconFilter} from 'app/icons';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

export enum SpanOperationBreakdownFilter {
  None,
  Http,
  Db,
  Browser,
  Resource,
}

const OPTIONS: SpanOperationBreakdownFilter[] = [
  SpanOperationBreakdownFilter.Http,
  SpanOperationBreakdownFilter.Db,
  SpanOperationBreakdownFilter.Browser,
  SpanOperationBreakdownFilter.Resource,
];

type Props = {
  currentFilter: SpanOperationBreakdownFilter;
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter) => void;
};

class Filter extends React.Component<Props> {
  render() {
    const {currentFilter, onChangeFilter} = this.props;

    const dropDownButtonProps: Pick<DropdownButtonProps, 'children' | 'priority'> & {
      hasDarkBorderBottomColor: boolean;
    } = {
      children: (
        <React.Fragment>
          <IconFilter size="xs" />
          <FilterLabel>
            {currentFilter === SpanOperationBreakdownFilter.None
              ? t('Filter')
              : tct('Filter - [operationName]', {
                  operationName: filterToString(currentFilter) as string,
                })}
          </FilterLabel>
        </React.Fragment>
      ),
      priority: 'default',
      hasDarkBorderBottomColor: false,
    };

    return (
      <Wrapper>
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
              <HeaderTitle>{t('Operation')}</HeaderTitle>
              <Radio
                radioSize="small"
                checked={SpanOperationBreakdownFilter.None === currentFilter}
                onChange={() => onChangeFilter(SpanOperationBreakdownFilter.None)}
              />
            </Header>
            <List>
              {Array.from([...OPTIONS], (filterOption, index) => {
                const operationName = filterToString(filterOption);
                return (
                  <ListItem key={String(index)} isChecked={false}>
                    <OperationDot backgroundColor={pickSpanBarColour(operationName)} />
                    <OperationName>{operationName}</OperationName>
                    <Radio
                      radioSize="small"
                      checked={filterOption === currentFilter}
                      onChange={() => onChangeFilter(filterOption)}
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

const HeaderTitle = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
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

export function filterToString(option: SpanOperationBreakdownFilter): string {
  switch (option) {
    case SpanOperationBreakdownFilter.Http:
      return 'http';
    case SpanOperationBreakdownFilter.Db:
      return 'db';
    case SpanOperationBreakdownFilter.Browser:
      return 'browser';
    case SpanOperationBreakdownFilter.Resource:
      return 'resource';
    default:
      throw Error(`Unknown option: ${option}`);
  }
}

export function filterToField(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return undefined;
    default: {
      return `span_op_breakdowns.ops.${filterToString(option)}`;
    }
  }
}

export function filterToSearchConditions(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return undefined;
    default: {
      return `has:${filterToField(option)}`;
    }
  }
}

export function filterToColour(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return pickSpanBarColour('');
    default: {
      return pickSpanBarColour(filterToString(option));
    }
  }
}

export default Filter;
