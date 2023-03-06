import styled from '@emotion/styled';

import {IconInfo} from 'sentry/icons';
import {space} from 'sentry/styles/space';

const StyledNotificationBarIconInfo = styled(IconInfo)`
  margin-right: ${space(1)};
  color: ${p => p.theme.alert.info.iconColor};
`;

export const NotificationBar = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.textColor};
  background-color: ${p => p.theme.alert.info.backgroundLight};
  border-bottom: 1px solid ${p => p.theme.alert.info.border};
  padding: ${space(1.5)};
  font-size: 14px;
  line-height: normal;
  ${StyledNotificationBarIconInfo} {
    color: ${p => p.theme.alert.info.iconColor};
  }
`;
