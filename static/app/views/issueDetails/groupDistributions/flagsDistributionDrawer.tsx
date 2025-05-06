import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Flex} from 'sentry/components/container/flex';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Checkbox} from 'sentry/components/core/checkbox';
import {EventDrawerBody, EventNavigator} from 'sentry/components/events/eventDrawer';
import FeatureFlagSort from 'sentry/components/events/featureFlags/featureFlagSort';
import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import {IconSentry} from 'sentry/icons/iconSentry';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
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

const SHOW_SCORES_LOCAL_STORAGE_KEY = 'flag-drawer-show-suspicion-scores';

export default function FlagsDistributionDrawer({group, organization, setTab}: Props) {
  const environments = useEnvironmentsFromUrl();
  const {tagKey} = useParams<{tagKey: string}>();

  // If we're showing the suspect section at all
  const enableSuspectFlags = organization.features.includes('feature-flag-suspect-flags');

  // If the user is allowed to toggle debugging on/off
  // This is internal only
  const showSuspectSandboxUI = organization.features.includes(
    'suspect-scores-sandbox-ui'
  );

  // If the user has suspect-score debugging turned on
  const [debugValue, setDebugSuspectScores] = useLocalStorageState(
    SHOW_SCORES_LOCAL_STORAGE_KEY,
    '0'
  );
  const debugSuspectScores = debugValue === '1';

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
          label: t('Suspiciousness'),
          value: SortBy.SUSPICION,
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

        {tagKey ? null : (
          <ButtonBar gap={1}>
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

            <TagFlagPicker setTab={setTab} tab={DrawerTab.FEATURE_FLAGS} />
          </ButtonBar>
        )}
      </EventNavigator>
      <EventDrawerBody>
        {tagKey ? (
          <AnalyticsArea name="feature_flag_details">
            <FlagDetailsDrawerContent />
          </AnalyticsArea>
        ) : (
          <AnalyticsArea name="feature_flag_distributions">
            {showSuspectSandboxUI && (
              <Flex>
                <Label>
                  <IconSentry size="xs" />
                  {t('Debug')}
                  <Checkbox
                    checked={debugSuspectScores}
                    onChange={() => {
                      setDebugSuspectScores(debugSuspectScores ? '0' : '1');
                    }}
                  />
                </Label>
              </Flex>
            )}
            <FlagDrawerContent
              debugSuspectScores={debugSuspectScores}
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

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-bottom: 0;
  cursor: pointer;
`;
