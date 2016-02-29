import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import DateTime from './dateTime';
import {t} from '../locale';

const MutedBox = React.createClass({
  propTypes: {
    statusDetails: React.PropTypes.object.isRequired
  },

  mixins: [PureRenderMixin],

  render() {
    let statusDetails = this.props.statusDetails;
    return (
      <div className="alert alert-info alert-block">
        {statusDetails.snoozeUntil ?
          <span>{t(
            'This issue has been snoozed until %s',
            <strong><DateTime date={statusDetails.snoozeUntil} /></strong>
          )} &mdash; </span>
        :
          <span>{t('This issue has been muted')} &mdash; </span>
        }
        {t('You will not be notified of any changes and it will not show up by default in feeds.')}
      </div>
    );
  }
});

export default MutedBox;
