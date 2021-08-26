import * as React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import ImageViewer from 'app/components/events/attachmentViewers/imageViewer';
import JsonViewer from 'app/components/events/attachmentViewers/jsonViewer';
import LogFileViewer from 'app/components/events/attachmentViewers/logFileViewer';
import RRWebJsonViewer from 'app/components/events/attachmentViewers/rrwebJsonViewer';
import EventAttachmentActions from 'app/components/events/eventAttachmentActions';
import EventDataSection from 'app/components/events/eventDataSection';
import FileSize from 'app/components/fileSize';
import {PanelTable} from 'app/components/panels';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {EventAttachment} from 'app/types';
import {Event} from 'app/types/event';
import AttachmentUrl from 'app/utils/attachmentUrl';
import withApi from 'app/utils/withApi';

import EventAttachmentsCrashReportsNotice from './eventAttachmentsCrashReportsNotice';

type Props = {
  api: Client;
  event: Event;
  orgId: string;
  projectId: string;
  location: Location;
  attachments: EventAttachment[];
  onDeleteAttachment: (attachmentId: EventAttachment['id']) => void;
};

type State = {
  attachmentPreviews: Record<string, boolean>;
  expanded: boolean;
};

class EventAttachments extends React.Component<Props, State> {
  state: State = {
    expanded: false,
    attachmentPreviews: {},
  };

  getInlineAttachmentRenderer(attachment: EventAttachment) {
    switch (attachment.mimetype) {
      case 'text/plain':
        return attachment.size > 0 ? LogFileViewer : undefined;
      case 'text/json':
      case 'text/x-json':
      case 'application/json':
        if (attachment.name === 'rrweb.json') {
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

  hasInlineAttachmentRenderer(attachment: EventAttachment): boolean {
    return !!this.getInlineAttachmentRenderer(attachment);
  }

  attachmentPreviewIsOpen = (attachment: EventAttachment) => {
    return !!this.state.attachmentPreviews[attachment.id];
  };

  renderInlineAttachment(attachment: EventAttachment) {
    const Component = this.getInlineAttachmentRenderer(attachment);
    if (!Component || !this.attachmentPreviewIsOpen(attachment)) {
      return null;
    }
    return (
      <AttachmentPreviewWrapper>
        <Component
          orgId={this.props.orgId}
          projectId={this.props.projectId}
          event={this.props.event}
          attachment={attachment}
        />
      </AttachmentPreviewWrapper>
    );
  }

  togglePreview(attachment: EventAttachment) {
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
              <React.Fragment key={attachment.id}>
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
                  <React.Fragment>
                    <div style={{display: 'none'}} />
                    <div style={{display: 'none'}} />
                  </React.Fragment>
                )}
              </React.Fragment>
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
  ${overflowEllipsis};
`;

const Size = styled('div')`
  text-align: right;
`;

const AttachmentPreviewWrapper = styled('div')`
  grid-column: auto / span 3;
  border: none;
  padding: 0;
`;
