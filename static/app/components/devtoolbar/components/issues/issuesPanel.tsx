import {useEffect, useState} from 'react';

import InfiniteListItems from 'sentry/components/devtoolbar/components/infiniteListItems';
import InfiniteListState from 'sentry/components/devtoolbar/components/infiniteListState';
import IssueListItem from 'sentry/components/devtoolbar/components/issueListItem';
import PanelLayout from 'sentry/components/devtoolbar/components/panelLayout';
import transactionToSearchTerm from 'sentry/components/devtoolbar/components/transactionToSearchTerm';
import {useScopeAndClient} from 'sentry/components/devtoolbar/hooks/useSentryClientAndScope';
import {listItemPlaceholderWrapperCss} from 'sentry/components/devtoolbar/styles/listItem';
import {
  panelDescCss,
  panelInsetContentCss,
  panelSectionCss,
} from 'sentry/components/devtoolbar/styles/panel';
import {resetFlexColumnCss} from 'sentry/components/devtoolbar/styles/reset';
import {smallCss} from 'sentry/components/devtoolbar/styles/typography';
import Placeholder from 'sentry/components/placeholder';

import useInfiniteIssuesList from './useInfiniteIssuesList';

export default function IssuesPanel() {
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
  const queryResult = useInfiniteIssuesList({
    query: `url:*${searchTerm}`,
  });

  const estimateSize = 89;
  const placeholderHeight = `${estimateSize - 8}px`; // The real height of the items, minus the padding-block value

  return (
    <PanelLayout title="Issues" showProjectBadge link={{url: '/issues/'}}>
      <div css={[smallCss, panelSectionCss, panelDescCss]}>
        <span>Unresolved issues related to this page</span>
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
