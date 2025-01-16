import {css} from '@emotion/react';

import InfiniteListItems from 'sentry/components/devtoolbar/components/infiniteListItems';
import InfiniteListState from 'sentry/components/devtoolbar/components/infiniteListState';
import IssueListItem from 'sentry/components/devtoolbar/components/issueListItem';
import PanelLayout from 'sentry/components/devtoolbar/components/panelLayout';
import useInfiniteReleaseIssuesList from 'sentry/components/devtoolbar/components/releases/useInfiniteReleaseIssuesList';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  panelDescCss,
  panelInsetContentCss,
  panelSectionCss,
  panelSectionCssNoBorder,
} from 'sentry/components/devtoolbar/styles/panel';
import {releaseBoxCss} from 'sentry/components/devtoolbar/styles/releasesPanel';
import {resetFlexColumnCss} from 'sentry/components/devtoolbar/styles/reset';
import {smallCss} from 'sentry/components/devtoolbar/styles/typography';
import Placeholder from 'sentry/components/placeholder';
import {IconSearch} from 'sentry/icons/iconSearch';

const estimateSize = 89;
const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

export default function ReleaseIsssues({releaseVersion}: {releaseVersion: string}) {
  const queryResult = useInfiniteReleaseIssuesList({
    releaseVersion,
  });

  return (
    <PanelLayout noBorder>
      <div
        css={css`
          display: grid;
          flex-grow: 1;
          grid-template-rows: auto 1fr;
        `}
      >
        <span
          css={[
            smallCss,
            panelDescCss,
            panelSectionCssNoBorder,
            css`
              padding-top: var(--space25);
              padding-bottom: 0;
            `,
          ]}
        >
          New Issues in This Release
        </span>
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
              emptyMessage={() => (
                <div
                  css={[
                    panelInsetContentCss,
                    releaseBoxCss,
                    resetFlexColumnCss,
                    css`
                      padding: var(--space400);
                      align-items: center;
                      gap: var(--space150);
                      height: 212px;
                      justify-content: center;
                    `,
                  ]}
                >
                  <IconSearch size="lg" />
                  No new issues in this release.
                </div>
              )}
            />
          </InfiniteListState>
        </div>
      </div>
    </PanelLayout>
  );
}
