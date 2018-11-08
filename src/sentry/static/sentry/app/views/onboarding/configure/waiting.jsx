import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import styled from 'react-emotion';

import Button from 'app/components/button';
import Hook from 'app/components/hook';
import SentryTypes from 'app/sentryTypes';

class Waiting extends React.Component {
  static propTypes = {
    skip: PropTypes.func,
    hasEvent: PropTypes.bool.isRequired,
    params: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  render() {
    let {hasEvent, organization, params} = this.props;
    let data = {params, organization, source: 'waiting'};

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
              <Button
                priority="primary"
                data-test-id="configure-done"
                onClick={this.props.skip}
              >
                {t('All done!')}
              </Button>
              {!hasEvent && <Hook name="component:sample-event" params={data} />}
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
