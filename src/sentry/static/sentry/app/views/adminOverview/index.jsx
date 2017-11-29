/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import ApiChart from './apiChart';
import EventChart from './eventChart';

import { t } from '../locale';

export default React.createClass({
    getInitialState() {
        return {
            since: new Date().getTime() / 1000 - 3600 * 24 * 7,
            resolution: '1h',
        };
    },

    render() {
        return (
            <div>
                <h3>{t('System Overview')}</h3>

                <div className="box">
                    <div className="box-header">
                        <h4>
                            {t('Event Throughput')}
                            <span id="rate" className="pull-right" />
                        </h4>
                    </div>
                    <EventChart since={this.state.since} resolution={this.state.resolution} />
                </div>

                <div className="box">
                    <div className="box-header">
                        <h4>{t('API Responses')}</h4>
                    </div>
                    <ApiChart since={this.state.since} resolution={this.state.resolution} />
                </div>
            </div>
        );
    },
});
