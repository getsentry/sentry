import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'sentry/api';
import AttachmentUrl from 'sentry/components/attachmentUrl';
import ImageViewer from 'sentry/components/events/attachmentViewers/imageViewer';
import JsonViewer from 'sentry/components/events/attachmentViewers/jsonViewer';
import LogFileViewer from 'sentry/components/events/attachmentViewers/logFileViewer';
import RRWebJsonViewer from 'sentry/components/events/attachmentViewers/rrwebJsonViewer';
import EventAttachmentActions from 'sentry/components/events/eventAttachmentActions';
import EventDataSection from 'sentry/components/events/eventDataSection';
import FileSize from 'sentry/components/fileSize';
import {PanelTable} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {IssueAttachment} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';

import EventAttachmentsCrashReportsNotice from './eventAttachmentsCrashReportsNotice';

type Props = {
  api: Client;
  attachments: IssueAttachment[];
  event: Event;
  location: Location;
  onDeleteAttachment: (attachmentId: IssueAttachment['id']) => void;
  orgId: string;
  projectId: string;
};

type State = {
  attachmentPreviews: Record<string, boolean>;
  expanded: boolean;
};

class EventAttachments extends Component<Props, State> {
  state: State = {
    expanded: false,
    attachmentPreviews: {},
  };

  getInlineAttachmentRenderer(attachment: IssueAttachment) {
    switch (attachment.mimetype) {
      case 'text/plain':
        return attachment.size > 0 ? LogFileViewer : undefined;
      case 'text/json':
      case 'text/x-json':
      case 'application/json':
        if (attachment.name === 'rrweb.json' || attachment.name.startsWith('rrweb-')) {
          return RRWebJsonViewer;
        }
        return JsonViewer;
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
        return ImageViewer;
      default:
        return undefined;
    }
  }

  hasInlineAttachmentRenderer(attachment: IssueAttachment): boolean {
    return !!this.getInlineAttachmentRenderer(attachment);
  }

  attachmentPreviewIsOpen = (attachment: IssueAttachment) => {
    return !!this.state.attachmentPreviews[attachment.id];
  };

  renderInlineAttachment(attachment: IssueAttachment) {
    const AttachmentComponent = this.getInlineAttachmentRenderer(attachment);
    if (!AttachmentComponent || !this.attachmentPreviewIsOpen(attachment)) {
      return null;
    }
    return (
      <AttachmentPreviewWrapper>
        <AttachmentComponent
          orgId={this.props.orgId}
          projectId={this.props.projectId}
          eventId={this.props.event.id}
          attachment={attachment}
        />
      </AttachmentPreviewWrapper>
    );
  }

  togglePreview(attachment: IssueAttachment) {
    this.setState(({attachmentPreviews}) => ({
      attachmentPreviews: {
        ...attachmentPreviews,
        [attachment.id]: !attachmentPreviews[attachment.id],
      },
    }));
  }

  render() {
    const {event, projectId, orgId, location, attachments, onDeleteAttachment} =
      this.props;
    const crashFileStripped = event.metadata.stripped_crash;

    if (!attachments.length && !crashFileStripped) {
      return null;
    }

    const title = t('Attachments (%s)', attachments.length);

    const lastAttachmentPreviewed =
      attachments.length > 0 &&
      this.attachmentPreviewIsOpen(attachments[attachments.length - 1]);

    return (
      <EventDataSection type="attachments" title={title}>
        {crashFileStripped && (
          <EventAttachmentsCrashReportsNotice
            orgSlug={orgId}
            projectSlug={projectId}
            groupId={event.groupID!}
            location={location}
          />
        )}

        {attachments.length > 0 && (
          <StyledPanelTable
            headers={[
              <Name key="name">{t('File Name')}</Name>,
              <Size key="size">{t('Size')}</Size>,
              t('Actions'),
            ]}
          >
            {attachments.map(attachment => (
              <Fragment key={attachment.id}>
                <Name>{attachment.name}</Name>
                <Size>
                  <FileSize bytes={attachment.size} />
                </Size>
                <AttachmentUrl
                  projectId={projectId}
                  eventId={event.id}
                  attachment={attachment}
                >
                  {url => (
                    <div>
                      <EventAttachmentActions
                        url={url}
                        onDelete={onDeleteAttachment}
                        onPreview={_attachmentId => this.togglePreview(attachment)}
                        withPreviewButton
                        previewIsOpen={this.attachmentPreviewIsOpen(attachment)}
                        hasPreview={this.hasInlineAttachmentRenderer(attachment)}
                        attachmentId={attachment.id}
                      />
                    </div>
                  )}
                </AttachmentUrl>
                {this.renderInlineAttachment(attachment)}
                {/* XXX: hack to deal with table grid borders */}
                {lastAttachmentPreviewed && (
                  <Fragment>
                    <div style={{display: 'none'}} />
                    <div style={{display: 'none'}} />
                  </Fragment>
                )}
              </Fragment>
            ))}
          </StyledPanelTable>
        )}
      </EventDataSection>
    );
  }
}

export default withApi<Props>(EventAttachments);

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr auto auto;
`;

const Name = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const Size = styled('div')`
  text-align: right;
`;

const AttachmentPreviewWrapper = styled('div')`
  grid-column: auto / span 3;
  border: none;
  padding: 0;
`;
