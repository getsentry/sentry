import {Link} from 'react-router';
import React from 'react';
import Cookies from 'js-cookie';
import styled from 'react-emotion';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

class SettingsBackButton extends React.Component {
  render() {
    // if the user needs to setup 2fa as part of the org invite flow,
    // send them back to accept the invite
    const pendingInvite = Cookies.get('pending-invite');

    if (!pendingInvite) {
      return null;
    }

    return (
      <BackButtonWrapper href={pendingInvite}>
        <Icon src="icon-arrow-left" size="10px" />
        {t('Back to Invite')}
      </BackButtonWrapper>
    );
  }
}

export default SettingsBackButton;

const BackButtonWrapper = styled(Link)`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray3};
  background: ${p => p.theme.whiteDark};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

const Icon = styled(InlineSvg)`
  margin: 0 6px 0 -3px;
  background: ${p => p.theme.offWhite2};
  border-radius: 50%;
  padding: ${space(0.5)};
  box-sizing: content-box;

  /* To ensure proper vertical centering */
  svg {
    display: block;
  }
`;
