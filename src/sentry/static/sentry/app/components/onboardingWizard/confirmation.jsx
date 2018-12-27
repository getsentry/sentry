import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';

class Confirmation extends React.Component {
  static propTypes = {
    onSkip: PropTypes.func.isRequired,
    dismiss: PropTypes.func.isRequired,
  };

  skip = e => {
    e.preventDefault();
    this.props.onSkip();
  };

  render() {
    return (
      <div className="ob-confirmation" onClick={this.props.dismiss}>
        <h3>{t('Need help?')}</h3>
        <p>
          <a href="mailto:support@sentry.io?subject=Help with onboarding">
            {t('Ask us!')}
          </a>{' '}
          · <a onClick={this.skip}>{t('Skip')}</a>
        </p>
      </div>
    );
  }
}

export default Confirmation;
