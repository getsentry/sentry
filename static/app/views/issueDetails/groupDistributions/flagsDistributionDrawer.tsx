import {Fragment, useState} from 'react';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {
  EventDrawerBody,
  EventNavigator,
  EventStickyControls,
} from 'sentry/components/events/eventDrawer';
import FeatureFlagSort from 'sentry/components/events/featureFlags/featureFlagSort';
import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import SuspectTable from 'sentry/components/issues/suspect/suspectTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import GroupDistributionsSearchInput from 'sentry/views/issueDetails/groupDistributions/groupDistributionsSearchInput';
import HeaderTitle from 'sentry/views/issueDetails/groupDistributions/headerTitle';
import TagFlagPicker from 'sentry/views/issueDetails/groupDistributions/tagFlagPicker';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {FlagDetailsDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/details/flagDetailsDrawerContent';
import FlagDrawerContent from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface Props {
  group: Group;
  organization: Organization;
  setTab: (value: DrawerTab) => void;
}

export default function FlagsDistributionDrawer({group, organization, setTab}: Props) {
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();

  // If we're showing the suspect section at all
  const enableSuspectFlags = organization.features.includes('feature-flag-suspect-flags');

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>(SortBy.ALPHABETICAL);
  const [orderBy, setOrderBy] = useState<OrderBy>(OrderBy.A_TO_Z);

  const sortByOptions = enableSuspectFlags
    ? [
        {
          label: t('Alphabetical'),
          value: SortBy.ALPHABETICAL,
        },
        {
          label: t('Distribution'),
          value: SortBy.DISTRIBUTION,
        },
      ]
    : [
        {
          label: t('Alphabetical'),
          value: SortBy.ALPHABETICAL,
        },
      ];
  const orderByOptions = enableSuspectFlags
    ? [
        {
          label: t('A-Z'),
          value: OrderBy.A_TO_Z,
        },
        {
          label: t('Z-A'),
          value: OrderBy.Z_TO_A,
        },
        {
          label: t('High to Low'),
          value: OrderBy.HIGH_TO_LOW,
        },
        {
          label: t('Low to High'),
          value: OrderBy.LOW_TO_HIGH,
        },
      ]
    : [
        {
          label: t('A-Z'),
          value: OrderBy.A_TO_Z,
        },
        {
          label: t('Z-A'),
          value: OrderBy.Z_TO_A,
        },
      ];

  return (
    <Fragment>
      <EventNavigator>
        <HeaderTitle
          tagKey={tagKey}
          tab={DrawerTab.FEATURE_FLAGS}
          includeFeatureFlagsTab
        />
      </EventNavigator>
      <EventDrawerBody>
        {!tagKey && enableSuspectFlags ? (
          <SuspectTable environments={environments} group={group} />
        ) : null}

        {tagKey ? null : (
          <EventStickyControls>
            <TagFlagPicker setTab={setTab} tab={DrawerTab.FEATURE_FLAGS} />

            <ButtonBar>
              <GroupDistributionsSearchInput
                includeFeatureFlagsTab
                search={search}
                onChange={value => {
                  setSearch(value);
                  trackAnalytics('tags.drawer.action', {
                    control: 'search',
                    organization,
                  });
                }}
              />

              <FeatureFlagSort
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
                orderByOptions={orderByOptions}
                sortByOptions={sortByOptions}
              />
            </ButtonBar>
          </EventStickyControls>
        )}

        {tagKey ? (
          <AnalyticsArea name="feature_flag_details">
            <FlagDetailsDrawerContent group={group} />
          </AnalyticsArea>
        ) : (
          <AnalyticsArea name="feature_flag_distributions">
            <FlagDrawerContent
              environments={environments}
              group={group}
              orderBy={orderBy}
              search={search}
              sortBy={sortBy}
            />
          </AnalyticsArea>
        )}
      </EventDrawerBody>
    </Fragment>
  );
}
