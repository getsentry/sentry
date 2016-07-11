import React from 'react';
import DateTime from '../../components/dateTime';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import utils from '../../utils';
import {t} from '../../locale';

const SeenInfo = React.createClass({
  propTypes: {
    date: React.PropTypes.any,
    release: React.PropTypes.shape({
      version: React.PropTypes.string.isRequired
    }),
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

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
    let {date, release, orgId, projectId} = this.props;
    return (
      <dl>
        <dt key={0}>{t('When')}:</dt>
        {date ?
          <dd key={1}><TimeSince date={date} /></dd>
        :
          <dd key={1}>n/a</dd>
        }
        <dt key={2}>{t('Date')}:</dt>
        {date ?
          <dd key={3}><DateTime date={date} seconds={true} /></dd>
        :
          <dd key={3}>n/a</dd>
        }
        <dt key={4}>{t('Release')}:</dt>
        {utils.defined(release) ?
          <dd key={5}><Version orgId={orgId} projectId={projectId} version={release.version} /></dd>
        : (date ?
          <dd key={5}><small style={{marginLeft: 5, fontStyle: 'italic'}}><a href={this.getReleaseTrackingUrl()}>not configured</a></small></dd>
        :
          <dd key={5}>n/a</dd>
        )}
      </dl>
    );
  }
});

export default SeenInfo;
