import React from 'react';
import DateTime from '../../components/dateTime';
import TimeSince from '../../components/timeSince';
import Version from '../../components/version';
import utils from '../../utils';
import {t} from '../../locale';

const SeenInfo = React.createClass({
  propTypes: {
    date: React.PropTypes.any.isRequired,
    release: React.PropTypes.shape({
      version: React.PropTypes.string.isRequired
    }),
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  render() {
    let {date, release} = this.props;
    return (
      <dl>
        <dt key={0}>{t('When')}:</dt>
        <dd key={1}><TimeSince date={date} /></dd>
        <dt key={2}>{t('Date')}:</dt>
        <dd key={3}><DateTime date={date} seconds={true} /></dd>
        {utils.defined(release) && [
          <dt key={4}>{t('Release')}:</dt>,
          <dd key={5}><Version orgId={this.props.orgId} projectId={this.props.projectId} version={release.version} /></dd>
        ]}
      </dl>
    );
  }
});

export default SeenInfo;
