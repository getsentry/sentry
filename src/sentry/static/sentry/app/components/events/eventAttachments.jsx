import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {Box} from 'grid-emotion';

import ApiMixin from 'app/mixins/apiMixin';
import FileSize from 'app/components/fileSize';
import GroupState from 'app/mixins/groupState';

import {t} from 'app/locale';

import {Panel, PanelBody, PanelItem} from 'app/components/panels';

export default createReactClass({
  displayName: 'EventAttachments',

  propTypes: {
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {attachmentList: undefined, expanded: false};
  },

  componentDidMount() {
    this.fetchData(this.props.event);
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.event && nextProps.event) {
      if (this.props.event.id !== nextProps.event.id) {
        //two events, with different IDs
        this.fetchData(nextProps.event);
      }
    } else if (nextProps.event) {
      //going from having no event to having an event
      this.fetchData(nextProps.event);
    }
  },

  fetchData(event) {
    // TODO(dcramer): this API request happens twice, and we need a store for it
    if (!event) return;
    this.api.request(
      `/projects/${this.props.orgId}/${this.props
        .projectId}/events/${event.id}/attachments/`,
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
  },

  getDownloadUrl(attachment) {
    let {orgId, event, projectId} = this.props;
    return `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download=1`;
  },

  render() {
    let {attachmentList} = this.state;
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
                      <a href={this.getDownloadUrl(attachment)}>
                        <strong>{attachment.name}</strong>
                      </a>
                    </Box>
                    <Box flex={1} textAlign="right">
                      <FileSize bytes={attachment.size} />
                    </Box>
                  </PanelItem>
                );
              })}
            </PanelBody>
          </Panel>
        </div>
      </div>
    );
  },
});
