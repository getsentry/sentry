import React from 'react';
import pick from 'lodash/pick';
import {RouteComponentProps} from 'react-router/lib/Router';

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
import {EventAttachment, Group} from 'app/types';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import AsyncView from 'app/views/asyncView';

type Props = RouteComponentProps<{orgId: string; groupId: string}, {}> & {
  api: Client;
  group: Group;
} & AsyncView['props'];

type State = {
  eventAttachmentsList: EventAttachment[];
  deletedAttachments: string[];
  loading: boolean;
  error: null | string;
  pageLinks: null | string;
} & AsyncView['state'];

class GroupEventAttachments extends AsyncView<Props, State> {
  getTitle() {
    // return routeTitleGen(t('Releases v2'), this.props.organization.slug, false);
    return 'jou';
  }

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
        'eventAttachmentsList',
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
    this.setState(prevState => {
      return {
        deletedAttachments: [...prevState.deletedAttachments, deletedAttachmentId],
      };
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

  renderLoading() {
    return this.renderBody();
  }

  renderInnerBody() {
    const {group, params, location} = this.props;
    const {loading, eventAttachmentsList, deletedAttachments} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (eventAttachmentsList.length > 0) {
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

    if (location.query.types) {
      return this.renderNoQueryResults();
    }

    return this.renderEmpty();
  }

  renderBody() {
    return (
      <Feature
        features={['event-attachments']}
        renderDisabled={() => <FeatureDisabled />}
      >
        <GroupEventAttachmentsFilter />
        <Panel className="event-list">
          <PanelBody>{this.renderInnerBody()}</PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </Feature>
    );
  }
}

export {GroupEventAttachments};

export default withApi(GroupEventAttachments);
