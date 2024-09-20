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
  ALPHA = 'alphabetical',
}

export const getLabel = (sort: string) => {
  switch (sort) {
    case FlagSort.OLDEST:
      return t('Oldest First');
    case FlagSort.ALPHA:
      return t('Alphabetical');
    case FlagSort.NEWEST:
    default:
      return t('Newest First');
  }
};

export const FLAG_SORT_OPTIONS = [
  {
    label: getLabel(FlagSort.NEWEST),
    value: FlagSort.NEWEST,
  },
  {
    label: getLabel(FlagSort.OLDEST),
    value: FlagSort.OLDEST,
  },
  {
    label: getLabel(FlagSort.ALPHA),
    value: FlagSort.ALPHA,
  },
];

export const enum FlagControlOptions {
  SEARCH = 'search',
  SORT = 'sort',
}

interface FlagDrawerProps {
  event: Event;
  group: Group;
  hydratedFlags: KeyValueDataContentProps[];
  initialSort: FlagSort;
  project: Project;
  focusControl?: FlagControlOptions;
}

export function FeatureFlagDrawer({
  group,
  event,
  project,
  initialSort,
  hydratedFlags,
  focusControl: initialFocusControl,
}: FlagDrawerProps) {
  const [sortMethod, setSortMethod] = useState<FlagSort>(initialSort);
  const [search, setSearch] = useState('');
  const organization = useOrganization();
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const handleSortAlphabetical = (flags: KeyValueDataContentProps[]) => {
    return [...flags].sort((a, b) => {
      return a.item.key.localeCompare(b.item.key);
    });
  };

  const sortedFlags =
    sortMethod === FlagSort.ALPHA
      ? handleSortAlphabetical(hydratedFlags)
      : sortMethod === FlagSort.OLDEST
        ? [...hydratedFlags].reverse()
        : hydratedFlags;
  const searchResults = sortedFlags.filter(f => f.item.key.includes(search));

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
        triggerProps={{
          'aria-label': t('Sort Flags'),
        }}
        onChange={selection => {
          setSortMethod(selection.value);
          trackAnalytics('flags.sort-flags', {
            organization,
            sortMethod: selection.value,
          });
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs" icon={<IconSort />}>
            {getLabel(sortMethod)}
          </DropdownButton>
        )}
        value={sortMethod}
        options={FLAG_SORT_OPTIONS}
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
