import {css} from '@emotion/react';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import AlertBadge from 'sentry/components/badge/alertBadge';
import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Incident} from 'sentry/views/alerts/types';
import {alertDetailsLink} from 'sentry/views/alerts/utils';

import useConfiguration from '../../hooks/useConfiguration';
import {
  badgeWithLabelCss,
  gridFlexEndCss,
  listItemGridCss,
  listItemPlaceholderWrapperCss,
} from '../../styles/listItem';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {resetFlexColumnCss} from '../../styles/reset';
import {smallCss, xSmallCss} from '../../styles/typography';
import InfiniteListItems from '../infiniteListItems';
import InfiniteListState from '../infiniteListState';
import PanelLayout from '../panelLayout';
import SentryAppLink from '../sentryAppLink';
import useTeams from '../teams/useTeams';

import useInfiniteAlertsList from './useInfiniteAlertsList';

export default function AlertsPanel() {
  const queryResult = useInfiniteAlertsList();

  const estimateSize = 84;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Alerts" showProjectBadge link={{url: '/alerts/'}}>
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
      <div
        css={css`
          grid-area: badge;
        `}
      >
        <AlertBadge status={item.status} isIssue={false} />
      </div>

      <div
        css={[
          gridFlexEndCss,
          xSmallCss,
          css`
            grid-area: time;
            color: var(--gray300);
          `,
        ]}
      >
        <TimeSince date={item.dateStarted} unitStyle="extraShort" />
      </div>

      <AnalyticsProvider nameVal="item" keyVal="item">
        <TextOverflow
          css={[
            smallCss,
            css`
              grid-area: name;
            `,
          ]}
        >
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

      {teamActor ? (
        <div
          css={[
            badgeWithLabelCss,
            xSmallCss,
            css`
              justify-self: flex-end;
              grid-area: icons;
            `,
          ]}
        >
          <ActorAvatar actor={teamActor} size={16} hasTooltip={false} />{' '}
          <TextOverflow>{teamActor.name}</TextOverflow>
        </div>
      ) : null}
    </div>
  );
}
