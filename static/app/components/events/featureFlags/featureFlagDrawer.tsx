import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import ButtonBar from 'sentry/components/buttonBar';
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
import FeatureFlagDistributions from 'sentry/components/events/featureFlags/featureFlagDistributions';
import FeatureFlagSort from 'sentry/components/events/featureFlags/featureFlagSort';
import {
  FlagControlOptions,
  OrderBy,
  SortBy,
  sortedFlags,
} from 'sentry/components/events/featureFlags/utils';
import useFocusControl from 'sentry/components/events/useFocusControl';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
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

export function FeatureFlagDrawer({
  group,
  event,
  project,
  initialSortBy,
  initialOrderBy,
  hydratedFlags,
  focusControl: initialFocusControl,
}: FlagDrawerProps) {
  const [tab, setTab] = useState<'eventFlags' | 'issueFlags'>('eventFlags');
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy);
  const [orderBy, setOrderBy] = useState<OrderBy>(initialOrderBy);
  const [search, setSearch] = useState('');
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const displayFlags = useMemo(
    () =>
      tab === 'eventFlags'
        ? sortedFlags({flags: hydratedFlags, sort: orderBy}).filter(f =>
            f.item.key.includes(search)
          )
        : [], // FeatureFlagDistributions has its own query for issue flags.
    [hydratedFlags, orderBy, search, tab]
  );

  const organization = useOrganization();
  const issueFlagsEnabled = organization.features.includes(
    'feature-flag-distribution-flyout'
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
      <FeatureFlagSort
        orderBy={orderBy}
        sortBy={sortBy}
        setSortBy={setSortBy}
        setOrderBy={setOrderBy}
      />
      {issueFlagsEnabled && (
        <SegmentedControl
          size="xs"
          value={tab}
          onChange={newTab => {
            if (newTab === 'eventFlags') {
              setSortBy(initialSortBy);
              setOrderBy(initialOrderBy);
            } else {
              setSortBy(SortBy.ALPHABETICAL);
              setOrderBy(OrderBy.A_TO_Z);
            }
            setTab(newTab);
          }}
        >
          <SegmentedControl.Item key="eventFlags">
            {t('Event Flags')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="issueFlags">
            {t('Issue Flags')}
          </SegmentedControl.Item>
        </SegmentedControl>
      )}
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
        {tab === 'eventFlags' || !issueFlagsEnabled ? (
          <CardContainer numCols={1}>
            <KeyValueData.Card expandLeft contentItems={displayFlags} />
          </CardContainer>
        ) : (
          <FeatureFlagDistributions group={group} search={search} orderBy={orderBy} />
        )}
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
