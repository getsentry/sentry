import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import {Event, EventAttachment} from 'app/types';
import {t} from 'app/locale';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import EventAttachmentActions from 'app/components/events/eventAttachmentActions';
import LogFileViewer from 'app/components/events/attachmentViewers/logFileViewer';
import JsonViewer from 'app/components/events/attachmentViewers/jsonViewer';
import ImageViewer from 'app/components/events/attachmentViewers/imageViewer';
import EventDataSection from 'app/components/events/eventDataSection';
import FileSize from 'app/components/fileSize';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import AttachmentUrl from 'app/utils/attachmentUrl';
import withApi from 'app/utils/withApi';
import Feature from 'app/components/acl/feature';

import EventAttachmentsCrashReportsNotice from './eventAttachmentsCrashReportsNotice';

type Props = {
  api: Client;
  event: Event;
  orgId: string;
  projectId: string;
  location: Location;
};

type State = {
  attachmentList: EventAttachment[];
  attachmentPreviews: Record<string, boolean>;
  expanded: boolean;
};

class EventAttachments extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  state: State = {
    attachmentList: [],
    expanded: false,
    attachmentPreviews: {},
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    let doFetch = false;
    if (!prevProps.event && this.props.event) {
      // going from having no event to having an event
      doFetch = true;
    } else if (this.props.event && this.props.event.id !== prevProps.event.id) {
      doFetch = true;
    }

    if (doFetch) {
      this.fetchData();
    }
  }

  // TODO(dcramer): this API request happens twice, and we need a store for it
  async fetchData() {
    const {event} = this.props;

    if (!event) {
      return;
    }

    try {
      const data = await this.props.api.requestPromise(
        `/projects/${this.props.orgId}/${this.props.projectId}/events/${event.id}/attachments/`
      );

      this.setState({
        attachmentList: data,
      });
    } catch (_err) {
      // TODO: Error-handling
      this.setState({
        attachmentList: [],
      });
    }
  }

  handleDelete = async (deletedAttachmentId: string) => {
    this.setState(prevState => ({
      attachmentList: prevState.attachmentList.filter(
        attachment => attachment.id !== deletedAttachmentId
      ),
    }));
  };

  getInlineAttachmentRenderer(attachment: EventAttachment) {
    const contentType = attachment.headers['Content-Type'] || '';
    const mimeType = contentType.split(';')[0].trim();
    switch (mimeType) {
      case 'text/plain':
        return attachment.size > 0 ? LogFileViewer : undefined;
      case 'text/json':
      case 'text/x-json':
      case 'application/json':
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

  attachmentPreviewIsOpen(attachment: EventAttachment) {
    return !!this.state.attachmentPreviews[attachment.id];
  }

  renderInlineAttachment(attachment: EventAttachment) {
    const Component = this.getInlineAttachmentRenderer(attachment);
    if (!Component || !this.attachmentPreviewIsOpen(attachment)) {
      return null;
    }
    return (
      <Component
        orgId={this.props.orgId}
        projectId={this.props.projectId}
        event={this.props.event}
        attachment={attachment}
      />
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
    const {event, projectId, orgId, location} = this.props;
    const {attachmentList} = this.state;
    const crashFileStripped = event.metadata.stripped_crash;

    if (!attachmentList.length && !crashFileStripped) {
      return null;
    }

    const title = t('Attachments (%s)', attachmentList.length);

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

        {attachmentList.length > 0 && (
          <Panel>
            <PanelBody>
              {attachmentList.map(attachment => (
                <React.Fragment key={attachment.id}>
                  <PanelItem alignItems="center">
                    <AttachmentName>{attachment.name}</AttachmentName>
                    <FileSizeWithGap bytes={attachment.size} />
                    <AttachmentUrl
                      projectId={projectId}
                      eventId={event.id}
                      attachment={attachment}
                    >
                      {url => (
                        <EventAttachmentActions
                          url={url}
                          onDelete={this.handleDelete}
                          onPreview={() => this.togglePreview(attachment)}
                          withPreviewButton
                          previewIsOpen={this.attachmentPreviewIsOpen(attachment)}
                          hasPreview={this.hasInlineAttachmentRenderer(attachment)}
                          attachmentId={attachment.id}
                        />
                      )}
                    </AttachmentUrl>
                  </PanelItem>
                  <Feature features={['event-attachments-viewer']}>
                    {this.renderInlineAttachment(attachment)}
                  </Feature>
                </React.Fragment>
              ))}
            </PanelBody>
          </Panel>
        )}
      </EventDataSection>
    );
  }
}

export default withApi<Props>(EventAttachments);

const AttachmentName = styled('div')`
  flex: 1;
  margin-right: ${space(2)};
  font-weight: bold;
  ${overflowEllipsis};
`;

const FileSizeWithGap = styled(FileSize)`
  margin-right: ${space(2)};
`;
