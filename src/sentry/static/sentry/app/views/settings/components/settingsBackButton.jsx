import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';
import {t} from '../../../locale';

import InlineSvg from '../../../components/inlineSvg';
import SentryTypes from '../../../proptypes';
import replaceRouterParams from '../../../utils/replaceRouterParams';
import withLatestContext from '../../../utils/withLatestContext';

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
    project: SentryTypes.Project,
  };

  render() {
    let {params, organization, project} = this.props;

    let projectId = params.projectId || (project && project.slug);
    let orgId = params.orgId || (organization && organization.slug);
    let url = projectId ? '/:orgId/:projectId/' : '/:orgId/';
    let label = projectId ? t('Project') : t('Organization');

    return (
      <BackButtonWrapper
        to={replaceRouterParams(url, {
          orgId,
          projectId,
        })}
      >
        <Icon src="icon-chevron-left" size="10px" /> Back to {label}
      </BackButtonWrapper>
    );
  }
}

const SettingsBackButton = withLatestContext(BackButton);

export default SettingsBackButton;
