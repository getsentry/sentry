import PropTypes from 'prop-types';
import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import DateTime from './dateTime';
import Duration from './duration';
import {t} from '../locale';

export default React.createClass({
  propTypes: {
    statusDetails: PropTypes.object.isRequired,
  },

  mixins: [PureRenderMixin],

  renderReason() {
    let details = this.props.statusDetails;
    if (details.ignoreUntil) {
      return t(
        'This issue has been ignored until %s',
        <strong>
          <DateTime date={details.ignoreUntil} />
        </strong>
      );
    } else if (details.ignoreCount && details.ignoreWindow) {
      return t(
        'This issue has been ignored until it occurs %s time(s) in %s',
        <strong>{details.ignoreCount.toLocaleString()}</strong>,
        <strong>
          <Duration seconds={details.ignoreWindow * 60} />
        </strong>
      );
    } else if (details.ignoreCount) {
      return t(
        'This issue has been ignored until it occurs %s more time(s)',
        <strong>{details.ignoreCount.toLocaleString()}</strong>
      );
    } else if (details.ignoreUserCount && details.ignoreUserWindow) {
      return t(
        'This issue has been ignored until it affects %s user(s) in %s',
        <strong>{details.ignoreUserCount.toLocaleString()}</strong>,
        <strong>
          <Duration seconds={details.ignoreUserWindow * 60} />
        </strong>
      );
    } else if (details.ignoreUserCount) {
      return t(
        'This issue has been ignored until it affects %s more user(s)',
        <strong>{details.ignoreUserCount.toLocaleString()}</strong>
      );
    }
    return t('This issue has been ignored');
  },

  render() {
    return (
      <div className="box">
        <span className="icon icon-soundoff" />
        <p>
          <span>{this.renderReason()} — </span>
          {t(
            'You will not be notified of any changes and it will not show up by default in feeds.'
          )}
        </p>
      </div>
    );
  },
});
