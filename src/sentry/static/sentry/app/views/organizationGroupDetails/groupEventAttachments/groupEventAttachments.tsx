import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import pick from 'lodash/pick';
import * as ReactRouter from 'react-router';

import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import AsyncComponent from 'app/components/asyncComponent';
import {EventAttachment} from 'app/types';

import GroupEventAttachmentsFilter from './groupEventAttachmentsFilter';
import GroupEventAttachmentsRow from './groupEventAttachmentsRow';

type Props = RouteComponentProps<{orgId: string; groupId: string}, {}> & {
  projectSlug: string;
};

type State = {
  eventAttachments: EventAttachment[];
} & AsyncComponent['state'];

class GroupEventAttachments extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      eventAttachments: [],
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

  handleDelete = () => {
    this.fetchData();
  };

  getEmptyMessage() {
    if (this.props.location.query.types) {
      return t('Sorry, no event attachments match your search query.');
    }

    return t("There don't seem to be any event attachments yet.");
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {projectSlug, params, location} = this.props;
    const {loading, eventAttachments} = this.state;

    return (
      <React.Fragment>
        <GroupEventAttachmentsFilter location={location} />
        <PanelTable
          headers={[t('Name'), t('Type'), t('Size'), t('Actions')]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={eventAttachments.length === 0}
          isLoading={loading}
        >
          {eventAttachments.map(attachment => (
            <GroupEventAttachmentsRow
              key={attachment.id}
              attachment={attachment}
              orgSlug={params.orgId}
              projectSlug={projectSlug}
              groupId={params.groupId}
              onDelete={this.handleDelete}
            />
          ))}
        </PanelTable>
        <Pagination pageLinks={this.state.eventAttachmentsPageLinks} />
      </React.Fragment>
    );
  }
}

export default ReactRouter.withRouter(GroupEventAttachments);
