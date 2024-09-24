import {useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
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

export enum FlagSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  A_TO_Z = 'a-z',
  Z_TO_A = 'z-a',
}

export enum SortGroup {
  EVAL_ORDER = 'eval',
  ALPHABETICAL = 'alphabetical',
}

export const getFlagSortLabel = (sort: string) => {
  switch (sort) {
    case FlagSort.A_TO_Z:
      return t('A-Z');
    case FlagSort.Z_TO_A:
      return t('Z-A');
    case FlagSort.OLDEST:
      return t('Oldest');
    case FlagSort.NEWEST:
    default:
      return t('Newest');
  }
};

export const getSortGroupLabel = (sort: string) => {
  switch (sort) {
    case SortGroup.ALPHABETICAL:
      return t('Alphabetical');
    case SortGroup.EVAL_ORDER:
    default:
      return t('Evaluation Order');
  }
};

export const getDefaultFlagSort = (sortGroup: SortGroup) => {
  return sortGroup === SortGroup.EVAL_ORDER ? FlagSort.NEWEST : FlagSort.A_TO_Z;
};

export const SORT_GROUP_OPTIONS = [
  {
    label: getSortGroupLabel(SortGroup.EVAL_ORDER),
    value: SortGroup.EVAL_ORDER,
  },
  {
    label: getSortGroupLabel(SortGroup.ALPHABETICAL),
    value: SortGroup.ALPHABETICAL,
  },
];

export const EVAL_ORDER_OPTIONS = [
  {
    label: getFlagSortLabel(FlagSort.NEWEST),
    value: FlagSort.NEWEST,
  },
  {
    label: getFlagSortLabel(FlagSort.OLDEST),
    value: FlagSort.OLDEST,
  },
];

export const ALPHA_OPTIONS = [
  {
    label: getFlagSortLabel(FlagSort.A_TO_Z),
    value: FlagSort.A_TO_Z,
  },
  {
    label: getFlagSortLabel(FlagSort.Z_TO_A),
    value: FlagSort.Z_TO_A,
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
  sort: FlagSort;
}): KeyValueDataContentProps[] => {
  switch (sort) {
    case FlagSort.A_TO_Z:
      return handleSortAlphabetical(flags);
    case FlagSort.Z_TO_A:
      return [...handleSortAlphabetical(flags)].reverse();
    case FlagSort.OLDEST:
      return [...flags].reverse();
    default:
      return flags;
  }
};

interface FlagDrawerProps {
  event: Event;
  group: Group;
  hydratedFlags: KeyValueDataContentProps[];
  initialFlagSort: FlagSort;
  initialSortGroup: SortGroup;
  project: Project;
  focusControl?: FlagControlOptions;
}

export function FeatureFlagDrawer({
  group,
  event,
  project,
  initialFlagSort,
  initialSortGroup,
  hydratedFlags,
  focusControl: initialFocusControl,
}: FlagDrawerProps) {
  const [sortGroup, setSortGroup] = useState<SortGroup>(initialSortGroup);
  const [flagSort, setFlagSort] = useState<FlagSort>(initialFlagSort);
  const [search, setSearch] = useState('');
  const organization = useOrganization();
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const searchResults = sortedFlags({flags: hydratedFlags, sort: flagSort}).filter(f =>
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
      <CompactSelect
        value={sortGroup}
        options={SORT_GROUP_OPTIONS}
        triggerProps={{
          'aria-label': t('Sort Group'),
        }}
        onChange={selection => {
          setFlagSort(getDefaultFlagSort(selection.value));
          setSortGroup(selection.value);
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs">
            {getSortGroupLabel(sortGroup)}
          </DropdownButton>
        )}
      />
      <CompactSelect
        value={flagSort}
        options={sortGroup === SortGroup.EVAL_ORDER ? EVAL_ORDER_OPTIONS : ALPHA_OPTIONS}
        triggerProps={{
          'aria-label': t('Flag Sort Type'),
        }}
        onChange={selection => {
          setFlagSort(selection.value);
          trackAnalytics('flags.sort-flags', {
            organization,
            sortMethod: selection.value,
          });
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs" icon={<IconSort />}>
            {getFlagSortLabel(flagSort)}
          </DropdownButton>
        )}
      />
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
