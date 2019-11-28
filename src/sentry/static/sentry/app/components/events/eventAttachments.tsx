import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Client} from 'app/api';
import {Event, EventAttachment} from 'app/types';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {t} from 'app/locale';
import AttachmentUrl from 'app/utils/attachmentUrl';
import FileSize from 'app/components/fileSize';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import EventAttachmentActions from 'app/components/events/eventAttachmentActions';

type Props = {
  api: Client;
  event: Event;
  orgId: string;
  projectId: string;
};

type State = {
  attachmentList: EventAttachment[];
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
        `/projects/${this.props.orgId}/${this.props.projectId}/events/${
          event.id
        }/attachments/`
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
    this.setState(prevState => {
      return {
        attachmentList: prevState.attachmentList.filter(
          attachment => attachment.id !== deletedAttachmentId
        ),
      };
    });
  };

  render() {
    const {attachmentList} = this.state;

    if (!attachmentList.length) {
      return null;
    }

    return (
      <div className="box">
        <div className="box-header">
          <h3>
            {t('Attachments')} ({attachmentList.length})
          </h3>
          <Panel>
            <PanelBody>
              {attachmentList.map(attachment => {
                return (
                  <PanelItem key={attachment.id} align="center">
                    <AttachmentName>{attachment.name}</AttachmentName>
                    <FileSizeWithGap bytes={attachment.size} />
                    <AttachmentUrl
                      projectId={this.props.projectId}
                      eventId={this.props.event.id}
                      attachment={attachment}
                    >
                      {url => (
                        <EventAttachmentActions
                          url={url}
                          onDelete={this.handleDelete}
                          attachmentId={attachment.id}
                        />
                      )}
                    </AttachmentUrl>
                  </PanelItem>
                );
              })}
            </PanelBody>
          </Panel>
        </div>
      </div>
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
