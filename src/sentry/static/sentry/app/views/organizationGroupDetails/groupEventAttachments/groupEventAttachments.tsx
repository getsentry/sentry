import { Fragment } from 'react';
import pick from 'lodash/pick';
import * as ReactRouter from 'react-router';

import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import AsyncComponent from 'app/components/asyncComponent';

import GroupEventAttachmentsTable from './groupEventAttachmentsTable';
import GroupEventAttachmentsFilter from './groupEventAttachmentsFilter';

type Props = {
  projectSlug: string;
} & ReactRouter.WithRouterProps &
  AsyncComponent['props'];

type State = {
  deletedAttachments: string[];
} & AsyncComponent['state'];

class GroupEventAttachments extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      deletedAttachments: [],
    };
  }

  getEndpoints(): [string, string, {}][] {
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

  handleDelete = (deletedAttachmentId: string) => {
    this.setState(prevState => ({
      deletedAttachments: [...prevState.deletedAttachments, deletedAttachmentId],
    }));
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

    if (eventAttachments.length > 0) {
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
      <Fragment>
        <GroupEventAttachmentsFilter />
        <Panel className="event-list">
          <PanelBody>{this.renderInnerBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.eventAttachmentsPageLinks} />
      </Fragment>
    );
  }
}

export default ReactRouter.withRouter(GroupEventAttachments);
