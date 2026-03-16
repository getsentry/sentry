import {Fragment, useState} from 'react';

import {Grid} from '@sentry/scraps/layout';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {
  EventDrawerBody,
  EventNavigator,
  EventStickyControls,
} from 'sentry/components/events/eventDrawer';
import {FeatureFlagSort} from 'sentry/components/events/featureFlags/featureFlagSort';
import {OrderBy} from 'sentry/components/events/featureFlags/utils';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import {GroupDistributionsSearchInput} from 'sentry/views/issueDetails/groupDistributions/groupDistributionsSearchInput';
import {HeaderTitle} from 'sentry/views/issueDetails/groupDistributions/headerTitle';
import {TagFlagPicker} from 'sentry/views/issueDetails/groupDistributions/tagFlagPicker';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import {FlagDetailsDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/details/flagDetailsDrawerContent';
import {FlagDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface Props {
  group: Group;
  organization: Organization;
  setTab: (value: DrawerTab) => void;
}

export function FlagsDistributionDrawer({group, organization, setTab}: Props) {
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();

  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState<OrderBy>(OrderBy.A_TO_Z);

  const orderByOptions = [
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
        {tagKey ? null : (
          <EventStickyControls>
            <TagFlagPicker setTab={setTab} tab={DrawerTab.FEATURE_FLAGS} />

            <Grid flow="column" align="center" gap="md">
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
                orderByOptions={orderByOptions}
              />
            </Grid>
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
            />
          </AnalyticsArea>
        )}
      </EventDrawerBody>
    </Fragment>
  );
}
