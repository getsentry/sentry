import {useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  SearchInput,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import useFocusControl from 'sentry/components/events/useFocusControl';
import {InputGroup} from 'sentry/components/inputGroup';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

export enum OrderBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  A_TO_Z = 'a-z',
  Z_TO_A = 'z-a',
}

export enum SortBy {
  EVAL_ORDER = 'eval',
  ALPHABETICAL = 'alphabetical',
}

export const getSelectionType = (selection: string) => {
  switch (selection) {
    case OrderBy.A_TO_Z:
    case OrderBy.Z_TO_A:
      return 'alphabetical';
    case OrderBy.OLDEST:
    case OrderBy.NEWEST:
    default:
      return 'eval';
  }
};

const getOrderByLabel = (sort: string) => {
  switch (sort) {
    case OrderBy.A_TO_Z:
      return t('A-Z');
    case OrderBy.Z_TO_A:
      return t('Z-A');
    case OrderBy.OLDEST:
      return t('Oldest First');
    case OrderBy.NEWEST:
    default:
      return t('Newest First');
  }
};

const getSortByLabel = (sort: string) => {
  switch (sort) {
    case SortBy.ALPHABETICAL:
      return t('Alphabetical');
    case SortBy.EVAL_ORDER:
    default:
      return t('Evaluation Order');
  }
};

export const getDefaultOrderBy = (sortBy: SortBy) => {
  return sortBy === SortBy.EVAL_ORDER ? OrderBy.NEWEST : OrderBy.A_TO_Z;
};

export const SORT_GROUP_OPTIONS = [
  {
    label: getSortByLabel(SortBy.EVAL_ORDER),
    value: SortBy.EVAL_ORDER,
  },
  {
    label: getSortByLabel(SortBy.ALPHABETICAL),
    value: SortBy.ALPHABETICAL,
  },
];

export const ORDER_BY_OPTIONS = [
  {
    label: getOrderByLabel(OrderBy.NEWEST),
    value: OrderBy.NEWEST,
  },
  {
    label: getOrderByLabel(OrderBy.OLDEST),
    value: OrderBy.OLDEST,
  },
  {
    label: getOrderByLabel(OrderBy.A_TO_Z),
    value: OrderBy.A_TO_Z,
  },
  {
    label: getOrderByLabel(OrderBy.Z_TO_A),
    value: OrderBy.Z_TO_A,
  },
];

export const enum FlagControlOptions {
  SEARCH = 'search',
  SORT = 'sort',
}

export const handleSortAlphabetical = (flags: KeyValueDataContentProps[]) => {
  return [...flags].sort((a, b) => {
    return a.item.key.localeCompare(b.item.key);
  });
};

export const sortedFlags = ({
  flags,
  sort,
}: {
  flags: KeyValueDataContentProps[];
  sort: OrderBy;
}): KeyValueDataContentProps[] => {
  switch (sort) {
    case OrderBy.A_TO_Z:
      return handleSortAlphabetical(flags);
    case OrderBy.Z_TO_A:
      return [...handleSortAlphabetical(flags)].reverse();
    case OrderBy.OLDEST:
      return [...flags].reverse();
    default:
      return flags;
  }
};

interface FlagDrawerProps {
  event: Event;
  group: Group;
  hydratedFlags: KeyValueDataContentProps[];
  initialOrderBy: OrderBy;
  initialSortBy: SortBy;
  project: Project;
  focusControl?: FlagControlOptions;
}

export function FeatureFlagDrawer({
  group,
  event,
  project,
  initialSortBy,
  initialOrderBy,
  hydratedFlags,
  focusControl: initialFocusControl,
}: FlagDrawerProps) {
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy);
  const [orderBy, setOrderBy] = useState<OrderBy>(initialOrderBy);
  const [search, setSearch] = useState('');
  const organization = useOrganization();
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const searchResults = sortedFlags({flags: hydratedFlags, sort: orderBy}).filter(f =>
    f.item.key.includes(search)
  );

  const actions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            setSearch(e.target.value.toLowerCase());
          }}
          aria-label={t('Search Flags')}
          {...getFocusProps(FlagControlOptions.SEARCH)}
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <CompositeSelect
        trigger={triggerProps => (
          <Button
            {...triggerProps}
            aria-label={t('Sort Flags')}
            size="xs"
            icon={<IconSort />}
          />
        )}
      >
        <CompositeSelect.Region
          label={t('Sort By')}
          value={sortBy}
          onChange={selection => {
            if (selection.value !== sortBy) {
              setOrderBy(getDefaultOrderBy(selection.value));
            }
            setSortBy(selection.value);
          }}
          options={SORT_GROUP_OPTIONS}
        />
        <CompositeSelect.Region
          label={t('Order By')}
          value={orderBy}
          onChange={selection => {
            setOrderBy(selection.value);
            trackAnalytics('flags.sort-flags', {
              organization,
              sortMethod: selection.value,
            });
          }}
          options={ORDER_BY_OPTIONS.map(o => {
            const selectionType = getSelectionType(o.value);
            return selectionType !== sortBy ? {...o, disabled: true} : o;
          })}
        />
      </CompositeSelect>
    </ButtonBar>
  );

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Feature Flags')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Feature Flags')}</Header>
        {actions}
      </EventNavigator>
      <EventDrawerBody>
        <CardContainer numCols={1}>
          <KeyValueData.Card contentItems={searchResults} />
        </CardContainer>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

export const CardContainer = styled('div')<{numCols: number}>`
  display: grid;
  grid-template-columns: repeat(${p => p.numCols}, 1fr);
  align-items: start;

  div {
    border: none;
    border-radius: 0;
  }

  > * {
    padding-left: 0px;
    :not(:first-child) {
      border-left: 1.5px solid ${p => p.theme.innerBorder};
      padding-left: ${space(2)};
      margin-left: -1px;
    }
    :not(:last-child) {
      border-right: 1.5px solid ${p => p.theme.innerBorder};
      padding-right: ${space(2)};
    }
  }
`;
