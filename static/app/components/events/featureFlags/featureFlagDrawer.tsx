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
} from 'sentry/components/events/eventReplay/eventDrawer';
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
import {getShortEventId} from 'sentry/utils/events';

export enum FlagSort {
  EVAL = 'eval',
  ALPHA = 'alphabetical',
}

export const getLabel = (sort: string) => {
  return sort === FlagSort.EVAL ? t('Evaluation Order') : t('Alphabetical');
};

export const FLAG_SORT_OPTIONS = [
  {
    label: getLabel(FlagSort.EVAL),
    value: FlagSort.EVAL,
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
}

export function FeatureFlagDrawer({
  group,
  event,
  project,
  initialSort,
  hydratedFlags,
}: FlagDrawerProps) {
  const [sortMethod, setSortMethod] = useState<FlagSort>(initialSort);
  const [search, setSearch] = useState('');

  const handleSortAlphabetical = (flags: KeyValueDataContentProps[]) => {
    return [...flags].sort((a, b) => {
      return a.item.key.localeCompare(b.item.key);
    });
  };

  const sortedFlags =
    sortMethod === FlagSort.ALPHA ? handleSortAlphabetical(hydratedFlags) : hydratedFlags;
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
