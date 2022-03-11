import * as React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import DropdownButton from 'sentry/components/dropdownButton';
import DropdownControl from 'sentry/components/dropdownControl';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import Radio from 'sentry/components/radio';
import {IconFilter} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';

import {decodeHistogramZoom} from './transactionOverview/latencyChart/utils';

type DropdownButtonProps = React.ComponentProps<typeof DropdownButton>;

// Make sure to update other instances like trends column fields, discover field types.
export enum SpanOperationBreakdownFilter {
  None = 'none',
  Http = 'http',
  Db = 'db',
  Browser = 'browser',
  Resource = 'resource',
}

export const SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD: Partial<
  Record<SpanOperationBreakdownFilter, string>
> = {
  [SpanOperationBreakdownFilter.Http]: 'spans.http',
  [SpanOperationBreakdownFilter.Db]: 'spans.db',
  [SpanOperationBreakdownFilter.Browser]: 'spans.browser',
  [SpanOperationBreakdownFilter.Resource]: 'spans.resource',
};

const OPTIONS: SpanOperationBreakdownFilter[] = [
  SpanOperationBreakdownFilter.Http,
  SpanOperationBreakdownFilter.Db,
  SpanOperationBreakdownFilter.Browser,
  SpanOperationBreakdownFilter.Resource,
];

export const spanOperationBreakdownSingleColumns = OPTIONS.map(o => `spans.${o}`);

type Props = {
  currentFilter: SpanOperationBreakdownFilter;
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  organization: OrganizationSummary;
};

function Filter(props: Props) {
  const {currentFilter, onChangeFilter, organization} = props;

  if (!organization.features.includes('performance-ops-breakdown')) {
    return null;
  }

  const dropDownButtonProps: Pick<DropdownButtonProps, 'children' | 'priority'> & {
    hasDarkBorderBottomColor: boolean;
  } = {
    children: (
      <React.Fragment>
        <IconFilter />
        <FilterLabel>
          {currentFilter === SpanOperationBreakdownFilter.None
            ? t('Filter')
            : tct('Filter - [operationName]', {
                operationName: currentFilter,
              })}
        </FilterLabel>
      </React.Fragment>
    ),
    priority: 'default',
    hasDarkBorderBottomColor: false,
  };

  return (
    <GuideAnchor target="span_op_breakdowns_filter" position="top">
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
            <Header
              onClick={event => {
                event.stopPropagation();
                onChangeFilter(SpanOperationBreakdownFilter.None);
              }}
            >
              <HeaderTitle>{t('Operation')}</HeaderTitle>
              <Radio
                radioSize="small"
                checked={SpanOperationBreakdownFilter.None === currentFilter}
              />
            </Header>
            <List>
              {Array.from([...OPTIONS], (filterOption, index) => {
                const operationName = filterOption;
                return (
                  <ListItem
                    key={String(index)}
                    isChecked={false}
                    onClick={event => {
                      event.stopPropagation();
                      onChangeFilter(filterOption);
                    }}
                  >
                    <OperationDot backgroundColor={pickBarColor(operationName)} />
                    <OperationName>{operationName}</OperationName>
                    <Radio radioSize="small" checked={filterOption === currentFilter} />
                  </ListItem>
                );
              })}
            </List>
          </MenuContent>
        </DropdownControl>
      </Wrapper>
    </GuideAnchor>
  );
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

export function filterToField(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return undefined;
    default: {
      return `spans.${option}`;
    }
  }
}

export function filterToSearchConditions(
  option: SpanOperationBreakdownFilter,
  location: Location
) {
  let field = filterToField(option);
  if (!field) {
    field = 'transaction.duration';
  }

  // Add duration search conditions implicitly

  const {min, max} = decodeHistogramZoom(location);
  let query = '';
  if (typeof min === 'number') {
    query = `${query} ${field}:>${min}ms`;
  }
  if (typeof max === 'number') {
    query = `${query} ${field}:<${max}ms`;
  }
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return query ? query.trim() : undefined;
    default: {
      return `${query} has:${filterToField(option)}`.trim();
    }
  }
}

export function filterToColor(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return pickBarColor('');
    default: {
      return pickBarColor(option);
    }
  }
}

export function stringToFilter(option: string) {
  if (
    Object.values(SpanOperationBreakdownFilter).includes(
      option as SpanOperationBreakdownFilter
    )
  ) {
    return option as SpanOperationBreakdownFilter;
  }

  return SpanOperationBreakdownFilter.None;
}

export function decodeFilterFromLocation(location: Location) {
  return stringToFilter(
    decodeScalar(location.query.breakdown, SpanOperationBreakdownFilter.None)
  );
}

export function filterToLocationQuery(option: SpanOperationBreakdownFilter) {
  return {
    breakdown: option as string,
  };
}

export default Filter;
