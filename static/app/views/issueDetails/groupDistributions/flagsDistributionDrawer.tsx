import {Fragment, useState} from 'react';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {EventDrawerBody, EventNavigator} from 'sentry/components/events/eventDrawer';
import {FeatureFlagSort} from 'sentry/components/events/featureFlags/featureFlagSort';
import {OrderBy} from 'sentry/components/events/featureFlags/utils';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useParams} from 'sentry/utils/useParams';
import {FlagDetailsDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/details/flagDetailsDrawerContent';
import {FlagDrawerContent} from 'sentry/views/issueDetails/groupFeatureFlags/flagDrawerContent';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

import {GroupDistributionsSearchInput} from './groupDistributionsSearchInput';
import {TagFlagPicker} from './tagFlagPicker';
import {DrawerTab} from './types';

interface Props {
  group: Group;
  organization: Organization;
  setTab: (value: DrawerTab) => void;
}

export function FlagsDistributionDrawer({group, organization, setTab}: Props) {
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();

  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState(OrderBy.A_TO_Z);

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
      {tagKey ? null : (
        <EventNavigator
          leadingItems={
            <GroupDistributionsSearchInput
              includeFeatureFlagsTab
              placeholder={t('Filter feature flags')}
              search={search}
              onChange={value => {
                setSearch(value);
                trackAnalytics('tags.drawer.action', {
                  control: 'search',
                  organization,
                });
              }}
            />
          }
          trailingItems={
            <Fragment>
              <TagFlagPicker setTab={setTab} tab={DrawerTab.FEATURE_FLAGS} />
              <FeatureFlagSort
                size="sm"
                variant="transparent"
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
            </Fragment>
          }
        />
      )}
      <EventDrawerBody>
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
