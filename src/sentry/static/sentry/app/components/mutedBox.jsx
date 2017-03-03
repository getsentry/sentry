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
      <div className="box">
        <span className="icon icon-soundoff" />
        <p>
          {statusDetails.ignoreUntil ?
            <span>{t(
              'This issue has been ignored until %s',
              <strong><DateTime date={statusDetails.ignoreUntil} /></strong>
            )} &mdash; </span>
          :
            <span>{t('This issue has been ignored')} &mdash; </span>
          }
          {t('You will not be notified of any changes and it will not show up by default in feeds.')}
        </p>
      </div>
    );
  }
});

export default MutedBox;
