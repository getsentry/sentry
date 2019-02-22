import {Link} from 'react-router';
import React from 'react';
import PropTypes from 'prop-types';
import Cookies from 'js-cookie';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/sentryTypes';
import replaceRouterParams from 'app/utils/replaceRouterParams';
import withLatestContext from 'app/utils/withLatestContext';
import space from 'app/styles/space';

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

class BackButton extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    lastRoute: PropTypes.string,
  };

  static contextTypes = {
    lastAppContext: PropTypes.oneOf(['project', 'organization']),
  };

  render() {
    const {params, organization, lastRoute} = this.props;
    const {lastAppContext} = this.context;
    // lastAppContext is set when Settings is initial loaded,
    // so if that is truthy, determine if we have project context at that point
    // otherwise use what we have in latest context (e.g. if you navigated to settings directly)
    const shouldGoBackToProject = lastRoute && lastAppContext === 'project';

    if (organization && organization.features.includes('sentry10')) {
      return null;
    }

    const projectId = shouldGoBackToProject || !lastAppContext ? params.projectId : null;
    const orgId = params.orgId || (organization && organization.slug);
    const url = projectId ? '/:orgId/:projectId/' : '/:orgId/';
    const label =
      shouldGoBackToProject || (!lastAppContext && projectId)
        ? t('Project')
        : t('Organization');

    // if the user needs to setup 2fa as part of the org invite flow,
    // send them back to accept the invite
    const pendingInvite = Cookies.get('pending-invite');

    if (pendingInvite) {
      return (
        <BackButtonWrapper href={pendingInvite}>
          <Icon src="icon-arrow-left" size="10px" />
          {t('Back to Invite')}
        </BackButtonWrapper>
      );
    }

    return (
      <BackButtonWrapper
        to={
          lastRoute ||
          replaceRouterParams(url, {
            orgId,
            projectId,
          })
        }
      >
        <Icon src="icon-arrow-left" size="10px" />
        {tct('Back to [label]', {label})}
      </BackButtonWrapper>
    );
  }
}

const SettingsBackButton = withLatestContext(BackButton);

export {BackButton};
export default SettingsBackButton;
