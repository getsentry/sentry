import React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';

type Props = {
  organizations: OrganizationSummary[];
};

class UnlinkedAlert extends React.Component<Props> {
  render = () => {
    const {organizations} = this.props;
    return (
      <StyledAlert type="warning" icon={<IconWarning />}>
        {t(
          'You\'ve selected Slack as your delivery method, but do not have a linked account for the following organizations. You\'ll receive email notifications instead until you type "/sentry link" into your Slack workspace to link your account. If slash commands are not working, please re-install the Slack integration.'
        )}
        <ul>
          {organizations.map(organization => (
            <li key={organization.id}>{organization.slug}</li>
          ))}
        </ul>
      </StyledAlert>
    );
  };
}
const StyledAlert = styled(Alert)`
  margin: 20px 0px;
`;

export default UnlinkedAlert;
