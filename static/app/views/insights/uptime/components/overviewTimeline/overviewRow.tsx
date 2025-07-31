import {css} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import ActorBadge from 'sentry/components/idBadge/actorBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {IconStats, IconTimer, IconUser} from 'sentry/icons';
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
    ruleIds: [uptimeRule.id],
    timeWindowConfig,
  });

  const ruleDetails = singleRuleView ? null : (
    <DetailsArea>
      <DetailsLink
        to={{
          pathname: makeAlertsPathname({
            path: `/rules/uptime/${uptimeRule.projectSlug}/${uptimeRule.id}/details/`,
            organization,
          }),
          query,
        }}
      >
        <DetailsHeadline>
          <Name>{uptimeRule.name}</Name>
        </DetailsHeadline>
        <Flex direction="column" gap="xs">
          <OwnershipDetails>
            {project && <ProjectBadge project={project} avatarSize={12} disableLink />}
            {uptimeRule.owner ? (
              <ActorBadge actor={uptimeRule.owner} avatarSize={12} />
            ) : (
              <Flex gap="xs" align="center">
                <IconUser size="xs" />
                {t('Unassigned')}
              </Flex>
            )}
          </OwnershipDetails>
          <Flex gap="xs" align="center">
            <Flex gap="xs" align="center">
              <IconTimer color="subText" size="xs" />
              <Text size="xs" variant="muted">
                {t('Checked every %s', getDuration(uptimeRule.intervalSeconds))}
              </Text>
            </Flex>
            {summary === undefined ? null : summary === null ? (
              <Text size="xs">
                <Placeholder width="60px" height="1lh" />
              </Text>
            ) : (
              <Flex gap="xs" align="center">
                <IconStats color="subText" size="xs" />
                <UptimePercent
                  size="xs"
                  summary={summary}
                  note={t(
                    'The percent uptime of this monitor in the selected time period.'
                  )}
                />
              </Flex>
            )}
          </Flex>
          <MonitorStatuses>
            {uptimeRule.status === 'disabled' && <Tag>{t('Disabled')}</Tag>}
          </MonitorStatuses>
        </Flex>
      </DetailsLink>
    </DetailsArea>
  );

  return (
    <TimelineRow
      key={uptimeRule.id}
      singleRuleView={singleRuleView}
      as={singleRuleView ? 'div' : 'li'}
    >
      {ruleDetails}
      <TimelineContainer>
        {isPending ? (
          <CheckInPlaceholder />
        ) : (
          <CheckInTimeline
            bucketedData={uptimeStats?.[uptimeRule.id] ?? []}
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

const DetailsLink = styled(Link)`
  display: block;
  padding: ${space(3)};
  color: ${p => p.theme.textColor};

  &:focus-visible {
    outline: none;
  }
`;

const DetailsArea = styled('div')`
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;
  position: relative;
`;

const DetailsHeadline = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr minmax(30px, max-content);
`;

const OwnershipDetails = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.75)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  word-break: break-word;
  margin-bottom: ${space(0.5)};
`;

const MonitorStatuses = styled('div')`
  display: flex;
  gap: ${space(0.5)};
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
