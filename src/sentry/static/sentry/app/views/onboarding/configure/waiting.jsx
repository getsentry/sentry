import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import styled from 'react-emotion';

import Button from 'app/components/buttons/button';
import HookStore from 'app/stores/hookStore';

class Waiting extends React.Component {
  static propTypes = {
    skip: PropTypes.func,
    hasEvent: PropTypes.bool.isRequired,
    isExposed: PropTypes.number,
    params: PropTypes.object,
  };

  render() {
    let Hook = HookStore.get('experiment:sample-event').length
      ? HookStore.get('experiment:sample-event')[0]()
      : undefined;

    return (
      <div className="awaiting-event">
        <div className="row">
          <div className="col-sm-10">
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
          <CenteredButtons className="col-sm-2">
            <div className="pull-right">
              <Button priority="primary" onClick={this.props.skip}>
                {t('All done!')}
              </Button>
              {this.props.isExposed && Hook && <Hook params={this.props.params} />}
            </div>
          </CenteredButtons>
        </div>
      </div>
    );
  }
}

const CenteredButtons = styled('div')`
  text-align: center;
`;

export default Waiting;
