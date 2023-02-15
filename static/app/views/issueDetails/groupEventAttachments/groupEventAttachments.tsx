import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import xor from 'lodash/xor';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import AsyncComponent from 'sentry/components/asyncComponent';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueAttachment, Project} from 'sentry/types';
import {decodeList} from 'sentry/utils/queryString';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import GroupEventAttachmentsFilter, {
  crashReportTypes,
  SCREENSHOT_TYPE,
} from './groupEventAttachmentsFilter';
import GroupEventAttachmentsTable from './groupEventAttachmentsTable';
import {ScreenshotCard} from './screenshotCard';

type Props = {
  project: Project;
} & WithRouterProps<{groupId: string; orgId: string}> &
  AsyncComponent['props'];

enum EventAttachmentFilter {
  ALL = 'all',
  CRASH_REPORTS = 'onlyCrash',
  SCREENSHOTS = 'screenshot',
}

type State = {
  deletedAttachments: string[];
  eventAttachments?: IssueAttachment[];
} & AsyncComponent['state'];

export const MAX_SCREENSHOTS_PER_PAGE = 12;

class GroupEventAttachments extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      deletedAttachments: [],
    };
  }

  getActiveAttachmentsTab() {
    const {location} = this.props;

    const types = decodeList(location.query.types);
    if (types.length === 0) {
      return EventAttachmentFilter.ALL;
    }
    if (types[0] === SCREENSHOT_TYPE) {
      return EventAttachmentFilter.SCREENSHOTS;
    }
    if (xor(crashReportTypes, types).length === 0) {
      return EventAttachmentFilter.CRASH_REPORTS;
    }
    return EventAttachmentFilter.ALL;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {params, location} = this.props;

    if (this.getActiveAttachmentsTab() === EventAttachmentFilter.SCREENSHOTS) {
      return [
        [
          'eventAttachments',
          `/issues/${params.groupId}/attachments/`,
          {
            query: {
              ...location.query,
              types: undefined, // need to explicitly set this to undefined because AsyncComponent adds location query back into the params
              screenshot: 1,
              per_page: MAX_SCREENSHOTS_PER_PAGE,
            },
          },
        ],
      ];
    }

    return [
      [
        'eventAttachments',
        `/issues/${params.groupId}/attachments/`,
        {
          query: {
            ...pick(location.query, ['cursor', 'environment', 'types']),
            per_page: 50,
          },
        },
      ],
    ];
  }

  handleDelete = async (deletedAttachmentId: string) => {
    const {params, project} = this.props;
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
        `/projects/${params.orgId}/${project.slug}/events/${attachment.event_id}/attachments/${attachment.id}/`,
        {
          method: 'DELETE',
        }
      );
    } catch (error) {
      addErrorMessage('An error occurred while deleteting the attachment');
    }
  };

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('No crash reports found')}</p>
      </EmptyStateWarning>
    );
  }

  renderNoScreenshotsResults() {
    return (
      <EmptyStateWarning>
        <p>{t('No screenshots found')}</p>
      </EmptyStateWarning>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('No attachments found')}</p>
      </EmptyStateWarning>
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderInnerBody() {
    const {project, params} = this.props;
    const {loading, eventAttachments, deletedAttachments} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (eventAttachments && eventAttachments.length > 0) {
      return (
        <GroupEventAttachmentsTable
          attachments={eventAttachments}
          orgId={params.orgId}
          projectSlug={project.slug}
          groupId={params.groupId}
          onDelete={this.handleDelete}
          deletedAttachments={deletedAttachments}
        />
      );
    }

    if (this.getActiveAttachmentsTab() === EventAttachmentFilter.CRASH_REPORTS) {
      return this.renderNoQueryResults();
    }

    return this.renderEmpty();
  }
  renderScreenshotGallery() {
    const {eventAttachments, loading} = this.state;
    const {project, params} = this.props;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (eventAttachments && eventAttachments.length > 0) {
      return (
        <ScreenshotGrid>
          {eventAttachments?.map((screenshot, index) => {
            return (
              <ScreenshotCard
                key={`${index}-${screenshot.id}`}
                eventAttachment={screenshot}
                eventId={screenshot.event_id}
                projectSlug={project.slug}
                groupId={params.groupId}
                onDelete={this.handleDelete}
                pageLinks={this.state.eventAttachmentsPageLinks}
                attachments={eventAttachments}
                attachmentIndex={index}
              />
            );
          })}
        </ScreenshotGrid>
      );
    }

    return this.renderNoScreenshotsResults();
  }

  renderAttachmentsTable() {
    return (
      <Panel className="event-list">
        <PanelBody>{this.renderInnerBody()}</PanelBody>
      </Panel>
    );
  }

  renderBody() {
    const {project} = this.props;
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <GroupEventAttachmentsFilter project={project} />
          {this.getActiveAttachmentsTab() === EventAttachmentFilter.SCREENSHOTS
            ? this.renderScreenshotGallery()
            : this.renderAttachmentsTable()}
          <Pagination pageLinks={this.state.eventAttachmentsPageLinks} />
        </Layout.Main>
      </Layout.Body>
    );
  }
}

export default withSentryRouter(GroupEventAttachments);

const ScreenshotGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-template-rows: repeat(2, max-content);
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(4, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: repeat(6, minmax(100px, 1fr));
  }
`;
