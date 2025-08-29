import {css} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {Tag} from 'sentry/components/core/badge/tag';
import {Container, Flex} from 'sentry/components/core/layout';
import {Link, type LinkProps} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import ActorBadge from 'sentry/components/idBadge/actorBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {IconStats, IconTimer, IconUser} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {UptimeRule, UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';
import {UptimePercent} from 'sentry/views/insights/uptime/components/percent';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

interface Props {
  timeWindowConfig: TimeWindowConfig;
  uptimeRule: UptimeRule;
  /**
   * Whether only one uptime rule is being rendered in a larger view with this
   * component. turns off things like zebra striping, hover effect, and showing
   * rule name.
   */
  singleRuleView?: boolean;
  summary?: UptimeSummary | null;
}

export function OverviewRow({
  summary,
  uptimeRule,
  timeWindowConfig,
  singleRuleView,
}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({
    organization,
    projectSlug: uptimeRule.projectSlug,
  });

  const location = useLocation();
  const query = pick(location.query, ['start', 'end', 'statsPeriod', 'environment']);

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    detectorIds: [uptimeRule.detectorId],
    timeWindowConfig,
  });

  const detailsPath = makeAlertsPathname({
    path: `/rules/uptime/${uptimeRule.projectSlug}/${uptimeRule.detectorId}/details/`,
    organization,
  });

  const ruleDetails = singleRuleView ? null : (
    <DetailsLink to={{pathname: detailsPath, query}}>
      <Name>{uptimeRule.name}</Name>
      <Details>
        <DetailsLine>
          {project && <ProjectBadge project={project} avatarSize={12} disableLink />}
          {uptimeRule.owner ? (
            <ActorBadge actor={uptimeRule.owner} avatarSize={12} />
          ) : (
            <Flex gap="xs" align="center">
              <IconUser size="xs" />
              {t('Unassigned')}
            </Flex>
          )}
        </DetailsLine>
        <DetailsLine>
          <Flex gap="xs" align="center">
            <IconTimer />
            {t('Checked every %s', getDuration(uptimeRule.intervalSeconds))}
          </Flex>
          {summary === undefined ? null : summary === null ? (
            <Placeholder width="60px" height="1lh" />
          ) : (
            <Flex gap="xs" align="center">
              <IconStats />
              <UptimePercent
                size="xs"
                summary={summary}
                note={t(
                  'The percent uptime of this monitor in the selected time period.'
                )}
              />
            </Flex>
          )}
        </DetailsLine>
        <div>{uptimeRule.status === 'disabled' && <Tag>{t('Disabled')}</Tag>}</div>
      </Details>
    </DetailsLink>
  );

  return (
    <TimelineRow
      key={uptimeRule.detectorId}
      singleRuleView={singleRuleView}
      as={singleRuleView ? 'div' : 'li'}
    >
      {ruleDetails}
      <TimelineContainer>
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            bucketedData={uptimeStats?.[uptimeRule.detectorId] ?? []}
            statusLabel={statusToText}
            statusStyle={tickStyle}
            statusPrecedent={checkStatusPrecedent}
            timeWindowConfig={timeWindowConfig}
            makeUnit={count => tn('check', 'checks', count)}
          />
        )}
      </TimelineContainer>
    </TimelineRow>
  );
}

function DetailsLink(props: LinkProps) {
  return (
    <Container border="primary" style={{borderWidth: 0, borderRightWidth: 1}}>
      <Flex direction="column" gap="sm" padding="xl">
        {flexProps => <InnerDetailsLink {...props} {...flexProps} />}
      </Flex>
    </Container>
  );
}

function Name(props: {children: React.ReactNode}) {
  return <Heading {...props} as="h3" size="lg" />;
}

function Details(props: {children: React.ReactNode}) {
  return (
    <IconDefaultsProvider size="xs">
      <Flex direction="column" gap="xs" {...props} />
    </IconDefaultsProvider>
  );
}

function DetailsLine(props: {children: React.ReactNode}) {
  return (
    <Flex wrap="wrap" gap="sm" align="center">
      {flexProps => <Text {...flexProps} variant="muted" size="sm" {...props} />}
    </Flex>
  );
}

const InnerDetailsLink = styled(Link)`
  color: ${p => p.theme.textColor};

  &:focus-visible {
    outline: none;
  }
`;

interface TimelineRowProps {
  isDisabled?: boolean;
  singleRuleView?: boolean;
}

const TimelineRow = styled('li')<TimelineRowProps>`
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: subgrid;

  ${p =>
    !p.singleRuleView &&
    css`
      transition: background 50ms ease-in-out;

      &:nth-child(odd) {
        background: ${p.theme.backgroundSecondary};
      }
      &:hover {
        background: ${p.theme.backgroundTertiary};
      }
      &:has(*:focus-visible) {
        background: ${p.theme.backgroundTertiary};
      }
    `}

  /* Disabled monitors become more opaque */
  --disabled-opacity: ${p => (p.isDisabled ? '0.6' : 'unset')};

  &:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

const TimelineContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(3)} 0;
  grid-column: 2/-1;
  opacity: var(--disabled-opacity);
`;
