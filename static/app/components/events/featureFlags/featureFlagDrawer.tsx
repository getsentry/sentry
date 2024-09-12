import {useState} from 'react';

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
} from 'sentry/components/events/breadcrumbs/breadcrumbsDrawer';
import {
  CardContainer,
  FLAG_SORT_OPTIONS,
  FlagSort,
  getLabel,
} from 'sentry/components/events/featureFlags/eventFeatureFlagList';
import {InputGroup} from 'sentry/components/inputGroup';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';

export const enum FlagControlOptions {
  SEARCH = 'search',
  SORT = 'sort',
}

interface FlagDrawerProps {
  event: Event;
  featureFlags: KeyValueDataContentProps[];
  group: Group;
  initialFlags: KeyValueDataContentProps[];
  project: Project;
  sort: FlagSort;
}

export function FeatureFlagDrawer({
  featureFlags,
  group,
  event,
  project,
  sort,
  initialFlags,
}: FlagDrawerProps) {
  const [sortMethod, setSortMethod] = useState<FlagSort>(sort);
  const [flags, setFlags] = useState<KeyValueDataContentProps[]>(featureFlags);
  const [search, setSearch] = useState('');

  const handleSortEval = () => {
    setFlags(initialFlags);
  };

  const handleSortAlphabetical = () => {
    setFlags(
      flags.sort((a, b) => {
        return a.item.key.localeCompare(b.item.key);
      })
    );
  };

  const actions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            // good spot to track analytics
            setSearch(e.target.value.toLowerCase());
            setFlags(featureFlags.filter(f => f.item.key.includes(search)));
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
          // good spot to track analytics
          setSortMethod(selection.value);
          selection.value === FlagSort.EVAL ? handleSortEval() : handleSortAlphabetical();
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
          <KeyValueData.Card contentItems={flags} />
        </CardContainer>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
