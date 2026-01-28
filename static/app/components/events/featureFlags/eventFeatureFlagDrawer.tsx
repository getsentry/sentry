import {useState} from 'react';
import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
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
import FeatureFlagSort from 'sentry/components/events/featureFlags/featureFlagSort';
import {
  FlagControlOptions,
  ORDER_BY_OPTIONS,
  SORT_BY_OPTIONS,
  sortedFlags,
  type OrderBy,
  type SortBy,
} from 'sentry/components/events/featureFlags/utils';
import useFocusControl from 'sentry/components/events/useFocusControl';
import {
  KeyValueData,
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

interface FlagDrawerProps {
  event: Event;
  group: Group;
  hydratedFlags: KeyValueDataContentProps[];
  initialOrderBy: OrderBy;
  initialSortBy: SortBy;
  project: Project;
  focusControl?: FlagControlOptions;
}

export function EventFeatureFlagDrawer({
  group,
  event,
  project,
  initialSortBy,
  initialOrderBy,
  hydratedFlags,
  focusControl: initialFocusControl,
}: FlagDrawerProps) {
  const organization = useOrganization();
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy);
  const [orderBy, setOrderBy] = useState<OrderBy>(initialOrderBy);
  const [search, setSearch] = useState('');
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const searchResults = sortedFlags({flags: hydratedFlags, sort: orderBy}).filter(f =>
    f.item.key.includes(search)
  );

  const actions = (
    <ButtonBar>
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
        sortByOptions={SORT_BY_OPTIONS}
        orderByOptions={ORDER_BY_OPTIONS}
        orderBy={orderBy}
        setOrderBy={value => {
          setOrderBy(value);
          trackAnalytics('flags.sort_flags', {
            organization,
            sortMethod: value as string,
          });
        }}
        setSortBy={value => {
          setSortBy(value);
          trackAnalytics('flags.sort_flags', {
            organization,
            sortMethod: value as string,
          });
        }}
        sortBy={sortBy}
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
          <KeyValueData.Card expandLeft contentItems={searchResults} />
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
    border-radius: ${space(0.5)};
  }

  > * {
    padding-left: 0px;

    &:first-child {
      margin-left: -${space(1)};
    }
    :not(:last-child) {
      border-right: 1.5px solid ${p => p.theme.tokens.border.secondary};
      padding-right: ${space(2)};
    }
    :not(:first-child) {
      border-left: 1.5px solid ${p => p.theme.tokens.border.secondary};
      padding-left: ${space(2)};
      padding-right: 0;
      margin-left: -1px;
    }
  }
`;
