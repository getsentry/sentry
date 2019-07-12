import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'grid-emotion';

import AsyncComponent from 'app/components/asyncComponent';
import Duration from 'app/components/duration';
import TimeSince from 'app/components/timeSince';
import {PanelBody, PanelItem} from 'app/components/panels';

import CheckInIcon from './checkInIcon';

export default class MonitorCheckIns extends AsyncComponent {
  static propTypes = {
    monitor: PropTypes.object.isRequired,
  };

  getEndpoints() {
    const {monitor} = this.props;
    return [
      ['checkInList', `/monitors/${monitor.id}/checkins/`, {query: {per_page: 10}}],
    ];
  }

  renderError() {
    return <div style={{margin: '18px 18px 0'}}>{super.renderError()}</div>;
  }

  renderBody() {
    return (
      <PanelBody>
        {this.state.checkInList.map(checkIn => {
          return (
            <PanelItem key={checkIn.id}>
              <Box style={{width: 16}} mr={2}>
                <CheckInIcon status={checkIn.status} size={16} />
              </Box>
              <Box flex="1" direction="column" mr={2}>
                <TimeSince date={checkIn.dateCreated} />
              </Box>
              <Box direction="column">
                {checkIn.duration && <Duration seconds={checkIn.duration / 100} />}
              </Box>
            </PanelItem>
          );
        })}
      </PanelBody>
    );
  }
}
