import IssueListItem from 'sentry/components/devtoolbar/components/issueListItem';
import Placeholder from 'sentry/components/placeholder';

import useCurrentTransactionName from '../../hooks/useCurrentTransactionName';
import {listItemPlaceholderWrapperCss} from '../../styles/listItem';
import {panelDescCss, panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {resetFlexColumnCss} from '../../styles/reset';
import {smallCss} from '../../styles/typography';
import InfiniteListItems from '../infiniteListItems';
import InfiniteListState from '../infiniteListState';
import PanelLayout from '../panelLayout';

import useInfiniteIssuesList from './useInfiniteIssuesList';

export default function IssuesPanel() {
  const transactionName = useCurrentTransactionName();
  const queryResult = useInfiniteIssuesList({
    query: `url:*${transactionName}`,
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
