import {css} from '@emotion/react';

import InfiniteListItems from 'sentry/components/devtoolbar/components/infiniteListItems';
import InfiniteListState from 'sentry/components/devtoolbar/components/infiniteListState';
import IssueListItem from 'sentry/components/devtoolbar/components/issueListItem';
import PanelLayout from 'sentry/components/devtoolbar/components/panelLayout';
import useInfiniteReleaseIssuesList from 'sentry/components/devtoolbar/components/releases/useInfiniteReleaseIssuesList';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  panelInsetContentCss,
  panelSectionCss,
} from 'sentry/components/devtoolbar/styles/panel';
import {infoHeaderCss} from 'sentry/components/devtoolbar/styles/releasesPanel';
import {resetFlexColumnCss} from 'sentry/components/devtoolbar/styles/reset';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';

const estimateSize = 89;
const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

export default function ReleaseIsssues({releaseVersion}: {releaseVersion: string}) {
  const queryResult = useInfiniteReleaseIssuesList({
    releaseVersion,
  });

  return (
    <PanelLayout>
      <div
        css={css`
          display: grid;
          flex-grow: 1;
          grid-template-rows: auto 1fr;
        `}
      >
        <PanelItem css={{padding: 'var(--space150)'}}>
          <div css={infoHeaderCss}>Latest issues related to this release</div>
        </PanelItem>
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
      </div>
    </PanelLayout>
  );
}
