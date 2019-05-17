import PropTypes from 'prop-types';
import {withRouter} from 'react-router';
import React from 'react';
import styled from 'react-emotion';
import {t} from 'app/locale';

import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';

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

    return (
      <Container hide={hide} onClick={dismiss}>
        <Header>{t('Want help?')}</Header>
        <div>
          <a onClick={this.toSupport}>{t('Go to Support')}</a> ·{' '}
          <a onClick={this.skip}>{t('Skip')}</a>
        </div>
      </Container>
    );
  }
}

const Container = styled('div')`
  position: absolute;
  top: 0px;
  display: ${p => {
    return p.hide ? 'none' : 'flex';
  }};
  bottom: 0px;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  background: rgba(255, 255, 255, 0.65);
  width: 100%;
  left: 0px;
`;

const Header = styled('h4')`
  margin-bottom: ${space(1)};
`;

export default withRouter(withOrganization(Confirmation));
