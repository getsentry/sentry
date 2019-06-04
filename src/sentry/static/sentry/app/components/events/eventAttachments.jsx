import PropTypes from 'prop-types';
import React from 'react';
import {Box} from 'grid-emotion';

import Button from 'app/components/button';
import FileSize from 'app/components/fileSize';

import {t} from 'app/locale';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import withApi from 'app/utils/withApi';
import AttachmentUrl from 'app/utils/attachmentUrl';

class EventAttachments extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  state = {
    attachmentList: undefined,
    expanded: false,
  };

  componentDidMount() {
    this.fetchData(this.props.event);
  }

  componentDidUpdate(prevProps) {
    let doFetch = false;
    if (!prevProps.event && this.props.event) {
      // going from having no event to having an event
      doFetch = true;
    } else if (this.props.event && this.props.event.id !== prevProps.event.id) {
      doFetch = true;
    }

    if (doFetch) {
      this.fetchData(this.props.event);
    }
  }

  fetchData(event) {
    // TODO(dcramer): this API request happens twice, and we need a store for it
    if (!event) {
      return;
    }
    this.props.api.request(
      `/projects/${this.props.orgId}/${this.props.projectId}/events/${
        event.id
      }/attachments/`,
      {
        success: (data, _, jqXHR) => {
          this.setState({
            attachmentList: data,
          });
        },
        error: error => {
          this.setState({
            attachmentList: undefined,
          });
        },
      }
    );
  }

  render() {
    const {attachmentList} = this.state;
    if (!(attachmentList && attachmentList.length)) {
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
                    <Box
                      flex={10}
                      pr={1}
                      style={{wordWrap: 'break-word', wordBreak: 'break-all'}}
                    >
                      <strong>{attachment.name}</strong>
                    </Box>
                    <Box flex={1} textAlign="right">
                      <FileSize bytes={attachment.size} />
                    </Box>
                    <Box flex={1} textAlign="center">
                      <AttachmentUrl
                        projectId={this.props.projectId}
                        event={this.props.event}
                        attachment={attachment}
                      >
                        {downloadUrl => (
                          <Button
                            size="xsmall"
                            icon="icon-download"
                            href={downloadUrl}
                            disabled={!downloadUrl}
                            title={
                              !downloadUrl &&
                              t('Insufficient permissions to download attachments')
                            }
                          >
                            {t('Download')}
                          </Button>
                        )}
                      </AttachmentUrl>
                    </Box>
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

export default withApi(EventAttachments);
