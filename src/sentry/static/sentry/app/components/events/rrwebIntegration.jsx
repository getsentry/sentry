import PropTypes from 'prop-types';
import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import LazyLoad from 'app/components/lazyLoad';

export default class RRWebIntegration extends AsyncComponent {
  static propTypes = {
    ...AsyncComponent.propTypes,
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  getEndpoints() {
    const {orgId, projectId, event} = this.props;
    return [
      [
        'attachmentList',
        `/projects/${orgId}/${projectId}/events/${event.id}/attachments/`,
        {query: {query: 'rrweb.json'}},
      ],
    ];
  }

  renderLoading() {
    // hide loading indicator
    return null;
  }

  renderBody() {
    const {attachmentList} = this.state;
    if (!attachmentList.length) {
      return null;
    }

    const attachment = attachmentList[0];
    const {orgId, projectId, event} = this.props;
    const url = `/api/0/projects/${orgId}/${projectId}/events/${event.id}/attachments/${attachment.id}/?download`;

    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Replay')}</h3>
          <Panel>
            <PanelBody>
              <PanelItem>
                <LazyLoad
                  component={() =>
                    import(
                      /* webpackChunkName: "rrwebReplayer" */ './rrwebReplayer'
                    ).then(mod => mod.default)
                  }
                  url={url}
                />
              </PanelItem>
            </PanelBody>
          </Panel>
        </div>
      </div>
    );
  }
}
