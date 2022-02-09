import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';

import {Client} from 'sentry/api';
import CompactIssue from 'sentry/components/issues/compactIssue';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

interface IssueListProps extends WithRouterProps {
  api: Client;
  endpoint: string;
  emptyText?: string;
  noBorder?: boolean;
  noMargin?: boolean;
  pagination?: boolean;
  query?: Record<string, any>;
  renderEmpty?: () => React.ReactElement;
}

interface IssueListState {
  data: Array<Group>;
  issueIds: Array<string>;
  pageLinks: string | null;
  status: 'loading' | 'error' | 'success';
}

function IssueList({
  api,
  endpoint,
  emptyText,
  query,
  location,
  pagination,
  renderEmpty,
  noBorder,
  noMargin,
}: IssueListProps): React.ReactElement {
  const [state, setState] = React.useState<IssueListState>({
    issueIds: [],
    status: 'loading',
    pageLinks: null,
    data: [],
  });

  const fetchIssueListData = React.useCallback(() => {
    api.clear();
    api.request(endpoint, {
      method: 'GET',
      query: {
        ...query,
        ...(location?.query?.cursor ? {cursor: location.query.cursor} : {}),
      },
      success: (data, _, resp) => {
        setState({
          data,
          status: 'success',
          issueIds: data.map(item => item.id),
          pageLinks: resp?.getResponseHeader('Link') ?? null,
        });
      },
      error: () => {
        setState({...state, status: 'error'});
      },
    });
  }, [query, endpoint, location.query, api]);

  React.useEffect(() => {
    // TODO: location should always be passed as a prop, check why we have this
    if (!location) {
      return;
    }

    setState({issueIds: [], status: 'loading', pageLinks: null, data: []});
    fetchIssueListData();
  }, [fetchIssueListData]);

  const panelStyles = React.useMemo(() => {
    const styles: React.CSSProperties = {
      ...(noBorder ? {border: 0, borderRadius: 0} : {}),
      ...(noMargin ? {marginBottom: 0} : {}),
    };

    return styles;
  }, [noBorder, noMargin]);

  return (
    <React.Fragment>
      {state.status === 'loading' ? (
        <div style={{margin: '18px 18px 0'}}>
          <LoadingIndicator />
        </div>
      ) : state.status === 'error' ? (
        <div style={{margin: `${space(2)} ${space(2)} 0`}}>
          <LoadingError onRetry={fetchIssueListData} />
        </div>
      ) : state.issueIds.length > 0 ? (
        <Panel style={panelStyles}>
          <PanelBody className="issue-list">
            {state.data.map(issue => (
              <CompactIssue key={issue.id} id={issue.id} data={issue} />
            ))}
          </PanelBody>
        </Panel>
      ) : renderEmpty ? (
        renderEmpty()
      ) : (
        <Panel style={panelStyles}>
          <EmptyMessage icon={<IconSearch size="xl" />}>
            {emptyText ?? t('Nothing to show here, move along.')}
          </EmptyMessage>
        </Panel>
      )}

      {pagination && state.pageLinks && <Pagination pageLinks={state.pageLinks} />}
    </React.Fragment>
  );
}

export {IssueList};

export default withRouter(withApi(IssueList));
