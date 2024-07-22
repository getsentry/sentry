import {css} from '@emotion/react';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import TimesTag from 'sentry/components/group/inboxBadges/timesTag';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import type {Group} from 'sentry/types/group';

import useConfiguration from '../../hooks/useConfiguration';
import useCurrentTransactionName from '../../hooks/useCurrentTransactionName';
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

import useInfiniteIssuesList from './useInfiniteIssuesList';

export default function FeedbackPanel() {
  const transactionName = useCurrentTransactionName();
  const queryResult = useInfiniteIssuesList({
    query: `url:*${transactionName}`,
  });

  const estimateSize = 108;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Issues">
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        <span>
          Unresolved issues related to <code>{transactionName}</code>
        </span>
      </div>

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
            itemRenderer={props => <IssueListItem {...props} />}
            emptyMessage={() => <p css={panelInsetContentCss}>No items to show</p>}
          />
        </InfiniteListState>
      </div>
    </PanelLayout>
  );
}

function IssueListItem({item}: {item: Group}) {
  const {projectSlug, projectId, trackAnalytics} = useConfiguration();

  return (
    <div css={listItemGridCss}>
      <TextOverflow
        css={[badgeWithLabelCss, smallCss]}
        style={{gridArea: 'name', fontWeight: item.hasSeen ? 'bold' : 400}}
      >
        <SentryAppLink
          to={{
            url: `/issues/${item.id}/`,
            query: {project: projectId, feedbackSlug: `${projectSlug}:${item.id}`},
          }}
          onClick={() => {
            trackAnalytics?.({
              eventKey: `devtoolbar.issue-list.item.click`,
              eventName: `devtoolbar: Click issue-list item`,
            });
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
          css={css({'&& img': {boxShadow: 'none'}})}
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
  );
}
