import {Component} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';

type Props = {
  organizations: OrganizationSummary[];
};

class UnlinkedAlert extends Component<Props> {
  render() {
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
  }
}
const StyledAlert = styled(Alert)`
  margin: 20px 0px;
`;

export default UnlinkedAlert;
