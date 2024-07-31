import {css} from '@emotion/react';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import AlertBadge from 'sentry/components/badge/alertBadge';
import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import ActivatedMetricAlertRuleStatus from 'sentry/views/alerts/list/rules/activatedMetricAlertRuleStatus';
import type {Incident, MetricAlert} from 'sentry/views/alerts/types';
import {CombinedAlertType} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';

import useConfiguration from '../../hooks/useConfiguration';
import {
  badgeWithLabelCss,
  gridFlexEndCss,
  listItemGridCss,
  listItemPlaceholderWrapperCss,
} from '../../styles/listItem';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {resetFlexColumnCss, resetFlexRowCss} from '../../styles/reset';
import {smallCss, xSmallCss} from '../../styles/typography';
import InfiniteListItems from '../infiniteListItems';
import InfiniteListState from '../infiniteListState';
import PanelLayout from '../panelLayout';
import SentryAppLink from '../sentryAppLink';
import useTeams from '../teams/useTeams';

import useInfiniteAlertsList from './useInfiniteAlertsList';

export default function AlertsPanel() {
  const {projectId, projectSlug, projectPlatform} = useConfiguration();
  const queryResult = useInfiniteAlertsList();

  const estimateSize = 84;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Alerts">
      <AnalyticsProvider nameVal="header" keyVal="header">
        <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
          <span css={[resetFlexRowCss, {gap: 'var(--space50)'}]}>
            Active alerts in{' '}
            <SentryAppLink to={{url: `/projects/${projectSlug}/`}}>
              <div
                css={[
                  resetFlexRowCss,
                  {display: 'inline-flex', gap: 'var(--space50)', alignItems: 'center'},
                ]}
              >
                <ProjectBadge
                  css={css({'&& img': {boxShadow: 'none'}})}
                  project={{
                    slug: projectSlug,
                    id: projectId,
                    platform: projectPlatform as PlatformKey,
                  }}
                  avatarSize={16}
                  hideName
                  avatarProps={{hasTooltip: false}}
                />
                {projectSlug}
              </div>
            </SentryAppLink>
          </span>
        </div>
      </AnalyticsProvider>

      <div css={resetFlexColumnCss}>
        <InfiniteListState
          queryResult={queryResult}
          backgroundUpdatingMessage={() => null}
          loadingMessage={() => (
            <div
              css={[
                resetFlexColumnCss,
                panelSectionCss,
                panelInsetContentCss,
                listItemPlaceholderWrapperCss,
              ]}
            >
              <Placeholder height={placeholderHeight} />
              <Placeholder height={placeholderHeight} />
              <Placeholder height={placeholderHeight} />
              <Placeholder height={placeholderHeight} />
            </div>
          )}
        >
          <InfiniteListItems
            estimateSize={() => estimateSize}
            queryResult={queryResult}
            itemRenderer={props => <AlertListItem {...props} />}
            emptyMessage={() => <p css={panelInsetContentCss}>No items to show</p>}
          />
        </InfiniteListState>
      </div>
    </PanelLayout>
  );
}

function AlertListItem({item}: {item: Incident}) {
  const {organizationSlug} = useConfiguration();

  const ownerId = item.alertRule.owner?.split(':').at(1);

  const {data: teams} = useTeams(
    {idOrSlug: String(ownerId)},
    {enabled: Boolean(ownerId)}
  );
  const ownerTeam = teams?.json.at(0);

  const teamActor = ownerId
    ? {type: 'team' as Actor['type'], id: ownerId, name: ownerTeam?.name ?? ''}
    : null;

  const rule: MetricAlert = {
    type: CombinedAlertType.METRIC,
    ...item.alertRule,
    latestIncident: item,
  };

  return (
    <div
      css={[
        listItemGridCss,
        css`
          grid-template-areas:
            'badge name time'
            'badge message message'
            '. icons icons';
          grid-template-columns: max-content 1fr max-content;
          gap: var(--space25) var(--space100);
        `,
      ]}
    >
      <div style={{gridArea: 'badge'}}>
        <AlertBadge status={item.status} isIssue={false} />
      </div>

      <div
        css={[gridFlexEndCss, xSmallCss]}
        style={{gridArea: 'time', color: 'var(--gray300)'}}
      >
        <TimeSince date={item.dateStarted} unitStyle="extraShort" />
      </div>

      <AnalyticsProvider nameVal="item" keyVal="item">
        <TextOverflow css={smallCss} style={{gridArea: 'name'}}>
          <SentryAppLink
            to={{
              url: alertDetailsLink({slug: organizationSlug} as Organization, item),
              query: {alert: item.identifier},
            }}
          >
            <strong>{item.title}</strong>
          </SentryAppLink>
        </TextOverflow>
      </AnalyticsProvider>

      <div css={smallCss} style={{gridArea: 'message'}}>
        <ActivatedMetricAlertRuleStatus rule={rule} />
      </div>

      {teamActor ? (
        <div
          css={[
            badgeWithLabelCss,
            xSmallCss,
            css`
              justify-self: flex-end;
            `,
          ]}
          style={{gridArea: 'icons'}}
        >
          <ActorAvatar actor={teamActor} size={16} hasTooltip={false} />{' '}
          <TextOverflow>{teamActor.name}</TextOverflow>
        </div>
      ) : null}
    </div>
  );
}
