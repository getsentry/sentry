import React from 'react';
import {t} from '../../../locale';

const Waiting = React.createClass({
  propTypes: {
    skip: React.PropTypes.func,
    hasEvent: React.PropTypes.bool.isRequired
  },

  render() {
    return (
      <div className="awaiting-event">
        <div className="pull-right">
          <div className="btn btn-primary" onClick={this.props.skip}>
            {t('All done!')}
          </div>
        </div>
        <div className="wrap waiting-text">
          {!this.props.hasEvent
            ? <h3 className="animated-ellipsis">{t('Waiting to receive an error')}</h3>
            : <h3>{t("You've successfully sent an error")}</h3>}
          <div className="robot">
            <span className="eye" />
          </div>
        </div>
      </div>
    );
  }
});

export default Waiting;
