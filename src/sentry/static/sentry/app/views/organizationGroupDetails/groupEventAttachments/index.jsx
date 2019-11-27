import PropTypes from 'prop-types';
import React from 'react';
import pick from 'lodash/pick';

import SentryTypes from 'app/sentryTypes';
import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupEventAttachmentsTable from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTable';
import GroupEventAttachmentsFilter from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
// import SearchBar from 'app/components/searchBar';
import parseApiError from 'app/utils/parseApiError';
import GroupStore from 'app/stores/groupStore';

class GroupEventAttachments extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      eventAttachmentsList: [],
      loading: true,
      error: false,
      pageLinks: '',
    };
  }

  componentWillMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.location.search !== prevProps.location.search) {
      this.fetchData();
    }
  }

  handleDelete = url => {
    this.setState({
      loading: true,
    });

    this.props.api.request(url, {
      method: 'DELETE',
      complete: () => this.fetchData(),
    });
  };

  fetchData = () => {
    this.setState({
      loading: true,
      error: false,
    });

    const query = {
      ...pick(this.props.location.query, ['cursor', 'environment', 'types']),
      limit: 50,
    };

    this.props.api.request(`/issues/${this.props.params.groupId}/attachments/`, {
      query,
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          eventAttachmentsList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
        GroupStore.updateEventAttachmentsCount(data.length, this.props.params.groupId);
      },
      error: err => {
        this.setState({
          error: parseApiError(err),
          loading: false,
        });
      },
    });
  };

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no event attachments match your search query.')}</p>
      </EmptyStateWarning>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t("There don't seem to be any event attachments yet.")}</p>
      </EmptyStateWarning>
    );
  }

  renderResults() {
    const {group, params} = this.props;

    return (
      <GroupEventAttachmentsTable
        attachments={this.state.eventAttachmentsList}
        orgId={params.orgId}
        projectId={group.project.slug}
        groupId={params.groupId}
        onDelete={this.handleDelete}
      />
    );
  }

  renderBody() {
    let body;

    if (this.state.loading) {
      body = <LoadingIndicator />;
    } else if (this.state.error) {
      body = <LoadingError message={this.state.error} onRetry={this.fetchData} />;
    } else if (this.state.eventAttachmentsList.length > 0) {
      body = this.renderResults();
    } else if (this.state.query && this.state.query !== '') {
      body = this.renderNoQueryResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  }

  render() {
    return (
      <div>
        <GroupEventAttachmentsFilter />
        <Panel className="event-list">
          <PanelBody>{this.renderBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
}

export {GroupEventAttachments};

export default withApi(GroupEventAttachments);
