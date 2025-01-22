import {useEffect, useMemo, useState} from 'react';
import {css} from '@emotion/react';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import AnalyticsProvider from 'sentry/components/devtoolbar/components/analyticsProvider';
import {useScopeAndClient} from 'sentry/components/devtoolbar/hooks/useSentryClientAndScope';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconChat, IconFatal, IconImage, IconMegaphone, IconPlay} from 'sentry/icons';
import useReplayCount from 'sentry/utils/replayCount/useReplayCount';

import useConfiguration from '../../hooks/useConfiguration';
import {useSDKFeedbackButton} from '../../hooks/useSDKFeedbackButton';
import useVisibility from '../../hooks/useVisibility';
import {
  badgeWithLabelCss,
  gridFlexEndCss,
  listItemGridCss,
  listItemPlaceholderWrapperCss,
} from '../../styles/listItem';
import {
  buttonRightCss,
  panelDescCss,
  panelHeadingRightCss,
  panelInsetContentCss,
  panelSectionCss,
} from '../../styles/panel';
import {resetButtonCss, resetFlexColumnCss} from '../../styles/reset';
import {smallCss, textOverflowTwoLinesCss, xSmallCss} from '../../styles/typography';
import type {FeedbackIssueListItem} from '../../types';
import InfiniteListItems from '../infiniteListItems';
import InfiniteListState from '../infiniteListState';
import PanelLayout from '../panelLayout';
import SentryAppLink from '../sentryAppLink';
import transactionToSearchTerm from '../transactionToSearchTerm';

import useInfiniteFeedbackList from './useInfiniteFeedbackList';

export default function FeedbackPanel() {
  const [, setVisible] = useVisibility();

  const buttonRef = useSDKFeedbackButton(
    useMemo(
      () => ({
        onFormOpen: () => setVisible('hidden'),
        onFormClose: () => setVisible('visible'),
      }),
      [setVisible]
    )
  );

  const {scope, client} = useScopeAndClient();
  const [searchTerm, setSearchTerm] = useState(
    transactionToSearchTerm(scope?.getScopeData().transactionName)
  );

  useEffect(() => {
    if (client) {
      return client.on('startNavigationSpan', options => {
        setSearchTerm(transactionToSearchTerm(options.name));
      });
    }
    return () => {};
  }, [client]);

  // Fetch issues based on the updated transaction name
  const queryResult = useInfiniteFeedbackList({
    query: `url:*${searchTerm}`,
  });

  const estimateSize = 108;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout
      showProjectBadge
      link={{url: '/feedback/'}}
      title="User Feedback"
      titleRight={
        buttonRef ? (
          <button
            aria-label="Submit Feedback"
            css={[resetButtonCss, panelHeadingRightCss]}
            ref={buttonRef}
            title="Submit Feedback"
          >
            <span css={buttonRightCss}>
              <IconMegaphone size="xs" />
              Report Bug
            </span>
          </button>
        ) : null
      }
    >
      <div css={[smallCss, panelSectionCss, panelDescCss]}>
        <span>Unresolved feedback related to this page</span>
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
            itemRenderer={props => <FeedbackListItem {...props} />}
            emptyMessage={() => <p css={panelInsetContentCss}>No items to show</p>}
          />
        </InfiniteListState>
      </div>
    </PanelLayout>
  );
}

function FeedbackListItem({item}: {item: FeedbackIssueListItem}) {
  const {projectSlug, projectId} = useConfiguration();
  const {feedbackHasReplay} = useReplayCountForFeedbacks();

  const hasReplayId = feedbackHasReplay(item.id);
  const isFatal = ['crash_report_embed_form', 'user_report_envelope'].includes(
    item.metadata.source ?? ''
  );
  const hasAttachments = item.latestEventHasAttachments;
  const hasComments = item.numComments > 0;

  return (
    <AnalyticsProvider nameVal="item" keyVal="item">
      <div css={listItemGridCss}>
        <TextOverflow css={smallCss} style={{gridArea: 'name'}}>
          <SentryAppLink
            to={{
              url: '/feedback/',
              query: {project: projectId, feedbackSlug: `${projectSlug}:${item.id}`},
            }}
          >
            <strong>
              {item.metadata.name ?? item.metadata.contact_email ?? 'Anonymous User'}
            </strong>
          </SentryAppLink>
        </TextOverflow>

        <div
          css={[gridFlexEndCss, xSmallCss]}
          style={{gridArea: 'time', color: 'var(--gray300)'}}
        >
          <TimeSince date={item.firstSeen} unitStyle="extraShort" />
        </div>

        <div style={{gridArea: 'message'}}>
          <TextOverflow css={[smallCss, textOverflowTwoLinesCss]}>
            {item.metadata.message}
          </TextOverflow>
        </div>

        <div css={[badgeWithLabelCss, xSmallCss]} style={{gridArea: 'owner'}}>
          {item.project ? (
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
          ) : null}
          <TextOverflow>{item.shortId}</TextOverflow>
        </div>

        <div css={gridFlexEndCss} style={{gridArea: 'icons'}}>
          {/* IssueTrackingSignals could have some refactoring so it doesn't
            depend on useOrganization, and so the filenames match up better with
            the exported functions */}
          {/* <IssueTrackingSignals group={item as unknown as Group} /> */}

          {hasComments ? <IconChat size="sm" /> : null}
          {isFatal ? <IconFatal size="xs" color="red400" /> : null}
          {hasReplayId ? <IconPlay size="xs" /> : null}
          {hasAttachments ? <IconImage size="xs" /> : null}
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

// Copied from sentry, but we're passing in a fake `organization` object here.
// TODO: refactor useReplayCountForFeedbacks to accept an org param
function useReplayCountForFeedbacks() {
  const {organizationSlug} = useConfiguration();
  const {hasOne, hasMany} = useReplayCount({
    bufferLimit: 25,
    dataSource: 'search_issues',
    fieldName: 'issue.id',
    organization: {slug: organizationSlug} as any,
    statsPeriod: '90d',
  });

  return useMemo(
    () => ({
      feedbackHasReplay: hasOne,
      feedbacksHaveReplay: hasMany,
    }),
    [hasMany, hasOne]
  );
}
