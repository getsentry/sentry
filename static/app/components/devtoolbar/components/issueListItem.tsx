import {css} from '@emotion/react';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {
  badgeWithLabelCss,
  gridFlexEndCss,
  listItemGridCss,
} from 'sentry/components/devtoolbar/styles/listItem';
import {smallCss, xSmallCss} from 'sentry/components/devtoolbar/styles/typography';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import type {Group} from 'sentry/types/group';

export default function IssueListItem({item}: {item: Group}) {
  const {projectId} = useConfiguration();

  return (
    <AnalyticsProvider keyVal="issue-list.item" nameVal="issue list item">
      <div css={listItemGridCss}>
        <TextOverflow
          css={[
            badgeWithLabelCss,
            smallCss,
            css`
              display: block;
            `,
          ]}
          style={{gridArea: 'name', fontWeight: item.hasSeen ? 'bold' : 400}}
        >
          <SentryAppLink
            to={{
              url: `/issues/${item.id}/`,
              query: {project: projectId},
            }}
          >
            <strong>{item.metadata.type ?? '<unknown>'}</strong>
          </SentryAppLink>
        </TextOverflow>

        <div
          css={[gridFlexEndCss, xSmallCss]}
          style={{gridArea: 'time', color: 'var(--gray300)'}}
        >
          <TimeSince date={item.firstSeen} unitStyle="extraShort" />
        </div>

        <div style={{gridArea: 'message'}}>
          <TextOverflow css={[smallCss]}>{item.metadata.value}</TextOverflow>
        </div>

        <div css={[badgeWithLabelCss, xSmallCss]} style={{gridArea: 'owner'}}>
          <ProjectBadge
            css={css`
              && img {
                box-shadow: none;
              }
            `}
            project={item.project}
            avatarSize={16}
            hideName
            avatarProps={{hasTooltip: false}}
          />
          <TextOverflow>{item.shortId}</TextOverflow>
        </div>

        <div css={gridFlexEndCss} style={{gridArea: 'icons'}}>
          {item.lifetime || item.firstSeen || item.lastSeen ? (
            <div className="flex-row">
              <TimesTag
                lastSeen={item.lifetime?.lastSeen || item.lastSeen}
                firstSeen={item.lifetime?.firstSeen || item.firstSeen}
              />
            </div>
          ) : null}

          {item.assignedTo ? (
            <ActorAvatar
              actor={item.assignedTo}
              size={16}
              tooltipOptions={{containerDisplayMode: 'flex'}}
            />
          ) : null}
        </div>
      </div>
    </AnalyticsProvider>
  );
}
