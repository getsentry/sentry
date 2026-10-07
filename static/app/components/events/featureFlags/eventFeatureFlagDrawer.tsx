import {useState} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {InputGroup} from '@sentry/scraps/input';
import {Grid} from '@sentry/scraps/layout';

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
import {FeatureFlagSort} from 'sentry/components/events/featureFlags/featureFlagSort';
import {
  FlagControlOptions,
  ORDER_BY_OPTIONS,
  sortedFlags,
  type OrderBy,
} from 'sentry/components/events/featureFlags/utils';
import {useFocusControl} from 'sentry/components/events/useFocusControl';
import {
  KeyValueColumns,
  KeyValueTableDataRow,
  type KeyValueTableDataRowProps,
} from 'sentry/components/tables/keyValueTable';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

interface FlagDrawerProps {
  event: Event;
  group: Group;
  hydratedFlags: KeyValueTableDataRowProps[];
  initialOrderBy: OrderBy;
  project: Project;
  focusControl?: FlagControlOptions;
}

export function EventFeatureFlagDrawer({
  group,
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
        <KeyValueColumns columnCount={1}>
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
