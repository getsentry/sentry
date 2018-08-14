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

const BackButtonWrapper = styled(Link)`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray3};
  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

const Icon = styled(InlineSvg)`
  margin: 0 6px 0 -3px;

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
    let {params, organization, lastRoute} = this.props;
    let {lastAppContext} = this.context;
    // lastAppContext is set when Settings is initial loaded,
    // so if that is truthy, determine if we have project context at that point
    // otherwise use what we have in latest context (e.g. if you navigated to settings directly)
    let shouldGoBackToProject = lastRoute && lastAppContext === 'project';

    let projectId = shouldGoBackToProject || !lastAppContext ? params.projectId : null;
    let orgId = params.orgId || (organization && organization.slug);
    let url = projectId ? '/:orgId/:projectId/' : '/:orgId/';
    let label =
      shouldGoBackToProject || (!lastAppContext && projectId)
        ? t('Project')
        : t('Organization');

    // if the user needs to setup 2fa as part of the org invite flow,
    // send them back to accept the invite
    let pendingInvite = Cookies.get('pending-invite');
    let shouldGoBackToInvite = pendingInvite && !lastAppContext;

    if (shouldGoBackToInvite) {
      return (
        <BackButtonWrapper href={pendingInvite}>
          <Icon src="icon-chevron-left" size="10px" />
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
        <Icon src="icon-chevron-left" size="10px" />
        {tct('Back to [label]', {label})}
      </BackButtonWrapper>
    );
  }
}

const SettingsBackButton = withLatestContext(BackButton);

export {BackButton};
export default SettingsBackButton;
