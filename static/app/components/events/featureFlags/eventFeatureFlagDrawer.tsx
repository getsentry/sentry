import {useState} from 'react';
import {IconSearch} from '@sentry/icons/search';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {InputGroup} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
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
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

import {FeatureFlagSort} from './featureFlagSort';
import {FlagControlOptions, ORDER_BY_OPTIONS, sortedFlags, type OrderBy} from './utils';

interface FlagDrawerProps {
  event: Event;
  hydratedFlags: KeyValueTableDataRowProps[];
  initialOrderBy: OrderBy;
  project: Project;
  focusControl?: FlagControlOptions;
}

export function EventFeatureFlagDrawer({
  event,
  project,
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

  const actions = (
    <Grid flow="column" align="center" gap="md">
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
      <FeatureFlagSort
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
    </Grid>
  );

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Feature Flags'),
            labelTooltip: t('Event ID: %s', getShortEventId(event.id)),
            leadingGraphic: <ProjectAvatar project={project} size={16} />,
          }}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Feature Flags')}</Header>
        {actions}
      </EventNavigator>
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
