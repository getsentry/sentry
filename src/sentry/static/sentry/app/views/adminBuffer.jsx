/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import InternalStatChart from '../components/internalStatChart';

import { t } from '../../locale';

const AdminBuffer = React.createClass({
    getInitialState() {
        return {
            since: new Date().getTime() / 1000 - 3600 * 24 * 7,
            resolution: '1h',
        };
    },

    render() {
        // TODO(dcramer): show buffer configuration when its moved into option store
        return (
            <div>
                <h3>{t('Buffers')}</h3>

                <div className="box">
                    <div className="box-header">
                        <h4>{t('About')}</h4>
                    </div>

                    <div className="box-content with-padding">
                        <p>
                            Sentry buffers are responsible for making changes to cardinality counters —
              such as an issues event count — as well as updating attributes like{' '}
                            <em>last seen</em>
                            . These are flushed on a regularly interval, and are directly affected by
              the queue backlog.
            </p>
                    </div>
                </div>

                <div className="box">
                    <div className="box-header">
                        <h4>{t('Updates Processed')}</h4>
                    </div>
                    <InternalStatChart
                        since={this.state.since}
                        resolution={this.state.resolution}
                        stat="jobs.finished.sentry.tasks.process_buffer.process_incr"
                        label={t('Jobs')}
                    />
                </div>

                <div className="box">
                    <div className="box-header">
                        <h4>{t('Revoked Updates')}</h4>
                    </div>
                    <InternalStatChart
                        since={this.state.since}
                        resolution={this.state.resolution}
                        stat="buffer.revoked"
                        label={t('Jobs')}
                    />
                </div>
            </div>
        );
    },
});

export default AdminBuffer;
