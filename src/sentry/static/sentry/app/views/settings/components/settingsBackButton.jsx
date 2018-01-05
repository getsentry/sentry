import {Link} from 'react-router';
import React from 'react';
import styled from 'react-emotion';
import {connect} from 'react-redux';

import SentryIcon from '../../../icons/sentryIcon';
import SentryTypes from '../../../proptypes';
import replaceRouterParams from '../../../utils/replaceRouterParams';

const BackButtonWrapper = styled(Link)`
  color: ${p => p.theme.gray3};
  &:hover {
    color: ${p => p.theme.gray5};
  }
`;

const SentryCrumb = styled(SentryIcon)`
  font-size: 20px;
  margin-right: 4px;
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

    return (
      <BackButtonWrapper
        to={replaceRouterParams(url, {
          orgId,
          projectId,
        })}
      >
        <SentryCrumb />
      </BackButtonWrapper>
    );
  }
}

export default connect(state => state.latestContext)(BackButton);
