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

type Props = WithRouterProps & {
  api: Client;
  endpoint: string;
  emptyText?: string;
  query?: Record<string, any>;
  pagination?: boolean;
  renderEmpty?: () => React.ReactElement;
  noBorder?: boolean;
  noMargin?: boolean;
};

type State = {
  issueIds: Array<string>;
  loading: boolean;
  error: boolean;
  pageLinks: string | null;
  data: Array<Group>;
};

class IssueList extends React.Component<Props, State> {
  state: State = this.getInitialState();

  getInitialState(): State {
    return {
      issueIds: [],
      loading: true,
      error: false,
      pageLinks: null,
      data: [],
    };
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps: Props) {
    const {location} = this.props;
    const nextLocation = nextProps.location;

    if (!location) {
      return;
    }

    if (
      location.pathname !== nextLocation.pathname ||
      location.search !== nextLocation.search
    ) {
      this.remountComponent();
    }
  }

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  }

  fetchData = () => {
    const {location, api, endpoint, query} = this.props;
    api.clear();
    api.request(endpoint, {
      method: 'GET',
      query: {
        cursor: (location && location.query && location.query.cursor) || '',
        ...query,
      },
      success: (data, _, resp) => {
        this.setState({
          data,
          loading: false,
          error: false,
          issueIds: data.map(item => item.id),
          pageLinks: resp?.getResponseHeader('Link') ?? null,
        });
      },
      error: () => {
        this.setState({loading: false, error: true});
      },
    });
  };

  renderError() {
    return (
      <div style={{margin: `${space(2)} ${space(2)} 0`}}>
        <LoadingError onRetry={this.fetchData} />
      </div>
    );
  }

  renderLoading() {
    return (
      <div style={{margin: '18px 18px 0'}}>
        <LoadingIndicator />
      </div>
    );
  }

  renderEmpty() {
    const {emptyText} = this.props;
    const {noBorder, noMargin} = this.props;
    const panelStyle: React.CSSProperties = noBorder ? {border: 0, borderRadius: 0} : {};
    if (noMargin) {
      panelStyle.marginBottom = 0;
    }

    return (
      <Panel style={panelStyle}>
        <EmptyMessage icon={<IconSearch size="xl" />}>
          {emptyText ? emptyText : t('Nothing to show here, move along.')}
        </EmptyMessage>
      </Panel>
    );
  }

  renderResults() {
    const {noBorder, noMargin, renderEmpty} = this.props;
    const {loading, error, issueIds, data} = this.state;

    if (loading) {
      return this.renderLoading();
    }

    if (error) {
      return this.renderError();
    }

    if (issueIds.length > 0) {
      const panelStyle: React.CSSProperties = noBorder
        ? {border: 0, borderRadius: 0}
        : {};
      if (noMargin) {
        panelStyle.marginBottom = 0;
      }

      return (
        <Panel style={panelStyle}>
          <PanelBody className="issue-list">
            {data.map(issue => (
              <CompactIssue key={issue.id} id={issue.id} data={issue} />
            ))}
          </PanelBody>
        </Panel>
      );
    }

    return renderEmpty?.() || this.renderEmpty();
  }

  render() {
    const {pageLinks} = this.state;
    const {pagination} = this.props;

    return (
      <React.Fragment>
        {this.renderResults()}
        {pagination && pageLinks && <Pagination pageLinks={pageLinks} {...this.props} />}
      </React.Fragment>
    );
  }
}

export {IssueList};

export default withRouter(withApi(IssueList));
