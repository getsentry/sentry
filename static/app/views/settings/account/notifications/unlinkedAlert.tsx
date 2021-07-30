import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';

const UnlinkedAlert = () => (
  <StyledAlert type="info" icon={<IconWarning />}>
    {t('You\'ve selected Slack as your delivery method, but do not have a linked account for one or more organizations. You\'ll receive email notifications instead until you type "/sentry link" into your Slack workspace to link your account.')}
  </StyledAlert>
);

const StyledAlert = styled(Alert)`
  margin: 20px 0px;
`;

export default UnlinkedAlert;
