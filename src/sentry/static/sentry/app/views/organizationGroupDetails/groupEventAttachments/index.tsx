import React from 'react';
import pick from 'lodash/pick';

import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import GroupEventAttachmentsTable from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsTable';
import GroupEventAttachmentsFilter from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import parseApiError from 'app/utils/parseApiError';
import {RouterProps, EventAttachment, Group} from 'app/types';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';

type Props = RouterProps & {
  api: Client;
  group: Group;
};

type State = {
  eventAttachmentsList: EventAttachment[];
  deletedAttachments: string[];
  loading: boolean;
  error: null | string;
  pageLinks: null | string;
};

class GroupEventAttachments extends React.Component<Props, State> {
  state = {
    eventAttachmentsList: [],
    deletedAttachments: [],
    loading: true,
    error: null,
    pageLinks: null,
  };

  componentWillMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.location.search !== prevProps.location.search) {
      this.fetchData();
    }
  }

  handleDelete = (deletedAttachmentId: string) => {
    this.setState(prevState => {
      return {
        deletedAttachments: [...prevState.deletedAttachments, deletedAttachmentId],
      };
    });
  };

  fetchData = () => {
    this.setState({
      loading: true,
      error: null,
    });

    const query = {
      ...pick(this.props.location.query, ['cursor', 'environment', 'types']),
      limit: 50,
    };

    this.props.api.request(`/issues/${this.props.params.groupId}/attachments/`, {
      query,
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState(prevState => ({
          eventAttachmentsList: data,
          error: null,
          loading: false,
          pageLinks: jqXHR ? jqXHR.getResponseHeader('Link') : prevState.pageLinks,
        }));
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
    const {eventAttachmentsList, deletedAttachments} = this.state;

    return (
      <GroupEventAttachmentsTable
        attachments={eventAttachmentsList}
        orgId={params.orgId}
        projectId={group.project.slug}
        groupId={params.groupId}
        onDelete={this.handleDelete}
        deletedAttachments={deletedAttachments}
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
    } else if (this.props.location.query.types) {
      body = this.renderNoQueryResults();
    } else {
      body = this.renderEmpty();
    }

    return body;
  }

  render() {
    return (
      <Feature
        features={['event-attachments']}
        renderDisabled={() => <FeatureDisabled />}
      >
        <GroupEventAttachmentsFilter />
        <Panel className="event-list">
          <PanelBody>{this.renderBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </Feature>
    );
  }
}

export {GroupEventAttachments};

export default withApi(GroupEventAttachments);
