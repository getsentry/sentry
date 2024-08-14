import styled from '@emotion/styled';

import {IconInfo} from 'sentry/icons';

const StyledNotificationBarIconInfo = styled(IconInfo)`
  margin-right: ${p => p.theme.space(1)};
  color: ${p => p.theme.alert.info.color};
`;

export const NotificationBar = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.textColor};
  background-color: ${p => p.theme.alert.info.backgroundLight};
  border-bottom: 1px solid ${p => p.theme.alert.info.border};
  padding: ${p => p.theme.space(1.5)};
  font-size: 14px;
  line-height: normal;
  ${StyledNotificationBarIconInfo} {
    color: ${p => p.theme.alert.info.color};
  }
`;
