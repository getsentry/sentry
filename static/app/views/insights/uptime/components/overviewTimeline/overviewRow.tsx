import {Fragment} from 'react';
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
import {IconClock, IconStats, IconTimer, IconUser} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UptimeDetector} from 'sentry/types/workflowEngine/detectors';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {UptimeSummary} from 'sentry/views/alerts/rules/uptime/types';
import {UptimeDuration} from 'sentry/views/insights/uptime/components/duration';
import {UptimePercent} from 'sentry/views/insights/uptime/components/percent';
import {
  checkStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/uptime/timelineConfig';
import {useUptimeMonitorStats} from 'sentry/views/insights/uptime/utils/useUptimeMonitorStats';

interface Props {
  timeWindowConfig: TimeWindowConfig;
  uptimeDetector: UptimeDetector;
  /**
   * Whether only one uptime detector is being rendered in a larger view with
   * this component. turns off things like zebra striping, hover effect, and
   * showing detector name.
   */
  single?: boolean;
  summary?: UptimeSummary | null;
}

export function OverviewRow({summary, uptimeDetector, timeWindowConfig, single}: Props) {
  const organization = useOrganization();
  const project = useProjectFromId({
    project_id: uptimeDetector.projectId,
  });

  const location = useLocation();
  const query = pick(location.query, ['start', 'end', 'statsPeriod', 'environment']);

  const {data: uptimeStats, isPending} = useUptimeMonitorStats({
    detectorIds: [uptimeDetector.id],
    timeWindowConfig,
  });

  const detailsPath = makeAlertsPathname({
    path: `/rules/uptime/${project?.slug}/${uptimeDetector.id}/details/`,
    organization,
  });

  // XXX(epurkhiser): This is a hack, we're seeing some uptime detectors with
  // missing dataSources. That should never happen, but for now let's make sure
  // we're not totally blowing up customers views
  if (uptimeDetector.dataSources === null) {
    return null;
  }

  const subscription = uptimeDetector.dataSources[0].queryObj;

  const ruleDetails = single ? null : (
    <DetailsLink to={{pathname: detailsPath, query}}>
      <Name>{uptimeDetector.name}</Name>
      <Details>
        <DetailsLine>
          {project && <ProjectBadge project={project} avatarSize={12} disableLink />}
          {uptimeDetector.owner ? (
            <ActorBadge actor={uptimeDetector.owner} avatarSize={12} />
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
            {t('Checked every %s', getDuration(subscription.intervalSeconds))}
          </Flex>
          {summary === null ? null : summary === undefined ? (
            <Fragment>
              <Placeholder width="60px" height="1lh" />
              <Placeholder width="40px" height="1lh" />
            </Fragment>
          ) : (
            <Fragment>
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
              <Flex gap="xs" align="center">
                <IconClock />
                <UptimeDuration size="xs" summary={summary} />
              </Flex>
            </Fragment>
          )}
        </DetailsLine>
        <div>{!uptimeDetector.enabled && <Tag variant="muted">{t('Disabled')}</Tag>}</div>
      </Details>
    </DetailsLink>
  );

  return (
    <TimelineRow
      key={uptimeDetector.id}
      singleRuleView={single}
      as={single ? 'div' : 'li'}
    >
      {ruleDetails}
      <TimelineContainer>
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            bucketedData={uptimeStats?.[uptimeDetector.id] ?? []}
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
  color: ${p => p.theme.tokens.content.primary};

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
        background: ${p.theme.tokens.background.secondary};
      }
      &:hover {
        background: ${p.theme.tokens.background.tertiary};
      }
      &:has(*:focus-visible) {
        background: ${p.theme.tokens.background.tertiary};
      }
    `}

  /* Disabled monitors become more opaque */
  --disabled-opacity: ${p => (p.isDisabled ? '0.6' : 'unset')};

  &:last-child {
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }
`;

const TimelineContainer = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(3)} 0;
  grid-column: 2/-1;
  opacity: var(--disabled-opacity);
`;
