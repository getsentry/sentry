import {withRouter, WithRouterProps} from 'react-router';
import pick from 'lodash/pick';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {IssueAttachment} from 'sentry/types';

import GroupEventAttachmentsFilter from './groupEventAttachmentsFilter';
import GroupEventAttachmentsTable from './groupEventAttachmentsTable';

type Props = {
  projectSlug: string;
} & WithRouterProps<{groupId: string; orgId: string}> &
  AsyncComponent['props'];

type State = {
  deletedAttachments: string[];
  eventAttachments?: IssueAttachment[];
} & AsyncComponent['state'];

class GroupEventAttachments extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      deletedAttachments: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;

    return [
      [
        'eventAttachments',
        `/issues/${params.groupId}/attachments/`,
        {
          query: {
            ...pick(location.query, ['cursor', 'environment', 'types']),
            limit: 50,
          },
        },
      ],
    ];
  }

  handleDelete = async (deletedAttachmentId: string) => {
    const {params, projectSlug} = this.props;
    const attachment = this.state?.eventAttachments?.find(
      item => item.id === deletedAttachmentId
    );
    if (!attachment) {
      return;
    }

    this.setState(prevState => ({
      deletedAttachments: [...prevState.deletedAttachments, deletedAttachmentId],
    }));

    try {
      await this.api.requestPromise(
        `/projects/${params.orgId}/${projectSlug}/events/${attachment.event_id}/attachments/${attachment.id}/`,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      addErrorMessage('An error occurred while deleting the attachment');
    }
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

  renderLoading() {
    return this.renderBody();
  }

  renderInnerBody() {
    const {projectSlug, params, location} = this.props;
    const {loading, eventAttachments, deletedAttachments} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (eventAttachments && eventAttachments.length > 0) {
      return (
        <GroupEventAttachmentsTable
          attachments={eventAttachments}
          orgId={params.orgId}
          projectId={projectSlug}
          groupId={params.groupId}
          onDelete={this.handleDelete}
          deletedAttachments={deletedAttachments}
        />
      );
    }

    if (location.query.types) {
      return this.renderNoQueryResults();
    }

    return this.renderEmpty();
  }

  renderBody() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <GroupEventAttachmentsFilter />
          <Panel className="event-list">
            <PanelBody>{this.renderInnerBody()}</PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.eventAttachmentsPageLinks} />
        </Layout.Main>
      </Layout.Body>
    );
  }
}

export default withRouter(GroupEventAttachments);
