import {useEffect} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {NumberInput} from 'sentry/components/core/input/numberInput';
import {Tooltip} from 'sentry/components/core/tooltip';
import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import useSuspectFlagScoreThreshold from 'sentry/components/issues/suspect/useSuspectFlagScoreThreshold';
import Link from 'sentry/components/links/link';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {IconSentry} from 'sentry/icons/iconSentry';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface Props {
  debugSuspectScores: boolean;
  environments: string[];
  group: Group;
}

export default function SuspectTable({debugSuspectScores, environments, group}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const [threshold, setThreshold] = useSuspectFlagScoreThreshold();
  const {baseUrl} = useGroupDetailsRoute();

  const {displayFlags, isPending} = useGroupFlagDrawerData({
    environments,
    group,
    orderBy: OrderBy.HIGH_TO_LOW,
    search: '',
    sortBy: SortBy.SUSPICION,
  });

  const debugThresholdInput = debugSuspectScores ? (
    <Flex gap={space(0.5)} align="center">
      <IconSentry size="xs" />
      Threshold:
      <NumberInput value={threshold} onChange={setThreshold} size="xs" />
    </Flex>
  ) : null;

  const susFlags = displayFlags.filter(flag => (flag.suspect.score ?? 0) > threshold);

  useEffect(() => {
    if (!isPending) {
      trackAnalytics('flags.suspect_flags_v2_found', {
        numTotalFlags: displayFlags.length,
        numSuspectFlags: susFlags.length,
        organization,
        threshold,
      });
    }
  }, [isPending, organization, displayFlags.length, susFlags.length, threshold]);

  if (displayFlags.length === 0) {
    // If there are no display flags then we don't need this section at all.
    return null;
  }

  const header = (
    <TagHeader>
      {t('Suspect Flags')}
      {debugThresholdInput}
      <FeedbackButton />
    </TagHeader>
  );

  if (isPending) {
    return (
      <GradientBox>
        {header}
        {t('Loading...')}
      </GradientBox>
    );
  }

  if (!susFlags.length) {
    return (
      <GradientBox>
        {header}
        {t('Nothing suspicious')}
      </GradientBox>
    );
  }

  return (
    <GradientBox>
      {header}

      <TagValueGrid>
        {susFlags.map(flag => {
          const topValue = flag.topValues[0];

          return (
            <TagValueRow key={flag.key}>
              {/* TODO: why is flag.name transformed to TitleCase? */}
              <Tooltip
                skipWrapper
                title={flag.key}
                showOnlyOnOverflow
                data-underline-on-hover="true"
              >
                <StyledLink
                  to={{
                    pathname: `${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}${flag.key}/`,
                    query: {
                      ...location.query,
                      tab: DrawerTab.FEATURE_FLAGS,
                    },
                  }}
                >
                  {flag.key}
                </StyledLink>
              </Tooltip>
              <RightAligned>
                {toRoundedPercent((topValue?.count ?? 0) / flag.totalValues)}
              </RightAligned>
              <span>{topValue?.value}</span>
            </TagValueRow>
          );
        })}
      </TagValueGrid>
    </GradientBox>
  );
}

function FeedbackButton() {
  const openFeedbackForm = useFeedbackForm();
  const title = t('Give feedback on Suspect Tags/Flags');
  const area = useAnalyticsArea();

  return (
    <Button
      title={title}
      aria-label={title}
      icon={<IconMegaphone />}
      size="xs"
      onClick={() =>
        openFeedbackForm?.({
          messagePlaceholder: t('How can we make Suspect Tags and Flags better for you?'),
          tags: {
            ['feedback.source']: area,
            ['feedback.owner']: 'replay',
          },
        })
      }
    />
  );
}

const GradientBox = styled('div')`
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  padding: ${space(1)};
  height: max-content;
  display: flex;
  flex-direction: column;
`;

const TagHeader = styled('h4')`
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const TagValueGrid = styled('ul')`
  display: grid;
  grid-template-columns: auto max-content max-content;
  gap: ${space(0.25)} ${space(0.5)};
  margin: 0;
  padding: 0;
  list-style: none;
`;

const TagValueRow = styled('li')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;

  align-items: center;
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-variant-numeric: tabular-nums;

  &:nth-child(2n) {
    background-color: ${p => Color(p.theme.gray300).alpha(0.1).toString()};
  }
`;

const StyledLink = styled(Link)`
  ${p => p.theme.overflowEllipsis};
  width: auto;

  &:hover [data-underline-on-hover='true'] {
    text-decoration: underline;
  }
`;

const RightAligned = styled('span')`
  text-align: right;
`;
