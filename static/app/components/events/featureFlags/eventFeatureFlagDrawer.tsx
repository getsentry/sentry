import {useState} from 'react';
import {IconSearch} from '@sentry/icons/search';

import {DrawerHeader} from '@sentry/scraps/drawer';
import {InputGroup} from '@sentry/scraps/input';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventNavigator,
  SearchInput,
} from 'sentry/components/events/eventDrawer';
import {useFocusControl} from 'sentry/components/events/useFocusControl';
import {
  KeyValueColumns,
  KeyValueTableDataRow,
  type KeyValueTableDataRowProps,
} from 'sentry/components/tables/keyValueTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

import {FeatureFlagSort} from './featureFlagSort';
import {FlagControlOptions, ORDER_BY_OPTIONS, sortedFlags, type OrderBy} from './utils';

interface FlagDrawerProps {
  event: Event;
  hydratedFlags: KeyValueTableDataRowProps[];
  initialOrderBy: OrderBy;
  focusControl?: FlagControlOptions;
}

export function EventFeatureFlagDrawer({
  event,
  initialOrderBy,
  hydratedFlags,
  focusControl: initialFocusControl,
}: FlagDrawerProps) {
  const organization = useOrganization();
  const [orderBy, setOrderBy] = useState(initialOrderBy);
  const [search, setSearch] = useState('');
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const searchResults = sortedFlags({flags: hydratedFlags, sort: orderBy}).filter(f =>
    f.item.key.includes(search)
  );

  const searchInput = (
    <InputGroup>
      <SearchInput
        size="sm"
        value={search}
        onChange={e => {
          setSearch(e.target.value.toLowerCase());
        }}
        aria-label={t('Search Flags')}
        placeholder={t('Filter feature flags')}
        {...getFocusProps(FlagControlOptions.SEARCH)}
      />
      <InputGroup.TrailingItems disablePointerEvents>
        <IconSearch size="xs" />
      </InputGroup.TrailingItems>
    </InputGroup>
  );

  const actions = (
    <FeatureFlagSort
      size="sm"
      variant="transparent"
      orderByOptions={ORDER_BY_OPTIONS}
      orderBy={orderBy}
      setOrderBy={value => {
        setOrderBy(value);
        trackAnalytics('flags.sort_flags', {
          organization,
          sortMethod: value as string,
        });
      }}
    />
  );

  return (
    <EventDrawerContainer>
      <DrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Feature Flags'),
            labelTooltip: t('Event ID: %s', getShortEventId(event.id)),
          }}
        />
      </DrawerHeader>
      <EventNavigator leadingItems={searchInput} trailingItems={actions} />
      <EventDrawerBody>
        <KeyValueColumns columnCount={1} maxKeyWidth="70%">
          {() => [
            searchResults.map((rowProps, index) => (
              <KeyValueTableDataRow key={index} {...rowProps} />
            )),
          ]}
        </KeyValueColumns>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}
