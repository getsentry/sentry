import React from 'react';
import DateTime from '../../components/dateTime';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import TooltipMixin from '../../mixins/tooltip';
import {defined, toTitleCase} from '../../utils';
import componentToString from '../../utils/componentToString';
import {t} from '../../locale';

const SeenInfo = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    date: React.PropTypes.any,
    dateGlobal: React.PropTypes.any,
    release: React.PropTypes.shape({
      version: React.PropTypes.string.isRequired
    }),
    environment: React.PropTypes.string,
    hasRelease: React.PropTypes.bool.isRequired,
  },

  mixins: [
    TooltipMixin(function () {
      let instance = this;

      return {
        html: true,
        selector: '.tip',
        title: function() {
          let {date, dateGlobal, environment, title} = instance.props;
          return componentToString(
            <div style={{width: 170}}>
              <div className="time-label">{title}</div>
              <dl className="flat">
                {environment && [
                  <dt key="0">{toTitleCase(environment)}</dt>,
                  <dd key="0.1">
                    <TimeSince date={date} /><br />
                  </dd>
                ]}
                <dt key="1">Globally:</dt>
                <dd key="1.1">
                  <TimeSince date={dateGlobal} /><br />
                </dd>
              </dl>
            </div>
          );
        }
      };
    })
  ],

  shouldComponentUpdate(nextProps, nextState) {
    return (
      (this.props.release || {}).version !== (nextProps.release || {}).version ||
      this.props.date !== nextProps.date
    );
  },

  getReleaseTrackingUrl() {
    let {orgId, projectId} = this.props;

    return `/${orgId}/${projectId}/settings/release-tracking/`;
  },

  render() {
    let {date, dateGlobal, environment, release, orgId, projectId} = this.props;
    return (
      <dl className="seen-info">
        <dt key={0}>{t('When')}:</dt>
        {date ?
          <dd key={1}>
            <span className="tip"><TimeSince date={date} /></span><br />
            <small><DateTime date={date} seconds={true} /></small>
          </dd>
        : (dateGlobal && environment === '' ?
          <dd key={1}>
            <span className="tip"><TimeSince date={dateGlobal} /></span><br />
            <small><DateTime date={dateGlobal} seconds={true} /></small>
          </dd>
        :
          <dd key={1}>n/a</dd>
        )}
        <dt key={4}>{t('Release')}:</dt>
        {defined(release) ?
          <dd key={5}><Version orgId={orgId} projectId={projectId} version={release.version} /></dd>
        : (!this.props.hasRelease ?
          <dd key={5}><small style={{marginLeft: 5, fontStyle: 'italic'}}><a href={this.getReleaseTrackingUrl()}>not configured</a></small></dd>
        :
          <dd key={5}>n/a</dd>
        )}
      </dl>
    );
  }
});

export default SeenInfo;
