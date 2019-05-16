import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import React from 'react';
import classNames from 'classnames';
import {t} from 'app/locale';

import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';

class Confirmation extends React.Component {
  static propTypes = {
    onSkip: PropTypes.func.isRequired,
    dismiss: PropTypes.func.isRequired,
    hide: PropTypes.bool.isRequired,
    router: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  skip = e => {
    e.preventDefault();
    this.props.onSkip();
  };

  toSupport = e => {
    e.preventDefault();
    const {router, organization} = this.props;
    router.push(`/settings/${organization.slug}/support/`);
  };

  render() {
    const {dismiss, hide} = this.props;
    const classes = classNames('ob-confirmation', {hide});

    return (
      <div className={classes} onClick={dismiss}>
        <h4>{t('Want help?')}</h4>
        <p>
          <a onClick={this.toSupport}>{t('Go to Support')}</a> ·{' '}
          <a onClick={this.skip}>{t('Skip')}</a>
        </p>
      </div>
    );
  }
}

export default withRouter(withOrganization(Confirmation));
