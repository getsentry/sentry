import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {t} from 'app/locale';

import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';

class Confirmation extends React.Component {
  static propTypes = {
    onSkip: PropTypes.func.isRequired,
    dismiss: PropTypes.func.isRequired,
    hide: PropTypes.bool.isRequired,
    organization: SentryTypes.Organization,
  };

  skip = e => {
    e.preventDefault();
    this.props.onSkip();
  };

  render() {
    const {dismiss, hide, organization} = this.props;

    return (
      <Container hide={hide} onClick={dismiss}>
        <Header>{t('Want help?')}</Header>
        <div>
          <Button priority="link" to={`/settings/${organization.slug}/support/`}>
            {t('Go to Support')}
          </Button>{' '}
          · <a onClick={this.skip}>{t('Skip')}</a>
        </div>
      </Container>
    );
  }
}

const Container = styled('div')`
  position: absolute;
  top: 0px;
  left: 0px;
  bottom: 0px;
  display: ${p => (p.hide ? 'none' : 'flex')};
  align-items: center;
  flex-direction: column;
  justify-content: center;
  background: rgba(255, 255, 255, 0.65);
  width: 100%;
`;

const Header = styled('h4')`
  margin-bottom: ${space(1)};
`;

export default withOrganization(Confirmation);
