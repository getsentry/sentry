import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

import Button from 'app/components/buttons/button';

class Waiting extends React.Component {
  static propTypes = {
    skip: PropTypes.func,
    hasEvent: PropTypes.bool.isRequired,
  };

  render() {
    return (
      <div className="awaiting-event">
        <div className="pull-right">
          <Button priority="primary" onClick={this.props.skip}>
            {t('All done')}
          </Button>
        </div>
        <div className="wrap waiting-text">
          {!this.props.hasEvent ? (
            <h3 className="animated-ellipsis">{t('Waiting to receive an error')}</h3>
          ) : (
            <h3>{t("You've successfully sent an error")}</h3>
          )}
          <div className="robot">
            <span className="eye" />
          </div>
        </div>
      </div>
    );
  }
}

export default Waiting;
