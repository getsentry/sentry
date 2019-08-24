import PropTypes from 'prop-types';
import React from 'react';

import InternalStatChart from 'app/components/internalStatChart';

export default class AdminBuffer extends React.Component {
  static propTypes = {
    resolution: PropTypes.string.isRequired,
  };

  static defaultProps = {
    resolution: '1h',
  };

  render() {
    // TODO(dcramer): show buffer configuration when its moved into option store
    const {resolution} = this.props;
    const since = new Date().getTime() / 1000 - 3600 * 24 * 7;

    return (
      <div>
        <h3>Buffers</h3>

        <div className="box">
          <div className="box-header">
            <h4>About</h4>
          </div>

          <div className="box-content with-padding">
            <p>
              Sentry buffers are responsible for making changes to cardinality counters —
              such as an issues event count — as well as updating attributes like{' '}
              <em>last seen</em>. These are flushed on a regularly interval, and are
              directly affected by the queue backlog.
            </p>
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h4>Updates Processed</h4>
          </div>
          <InternalStatChart
            since={since}
            resolution={resolution}
            stat="jobs.finished.sentry.tasks.process_buffer.process_incr"
            label="Jobs"
          />
        </div>

        <div className="box">
          <div className="box-header">
            <h4>Revoked Updates</h4>
          </div>
          <InternalStatChart
            since={since}
            resolution={resolution}
            stat="buffer.revoked"
            label="Jobs"
          />
        </div>
      </div>
    );
  }
}
