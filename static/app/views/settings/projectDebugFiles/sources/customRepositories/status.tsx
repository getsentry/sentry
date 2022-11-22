import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import {IconDownload} from 'sentry/icons/iconDownload';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AppStoreConnectStatusData} from 'sentry/types/debugFiles';

type Props = {
  onEditRepository: () => void;
  details?: AppStoreConnectStatusData;
};

function Status({details, onEditRepository}: Props) {
  const theme = useTheme();

  if (!details) {
    return <Placeholder height="14px" />;
  }

  const {pendingDownloads, credentials, lastCheckedBuilds} = details;

  if (credentials.status === 'invalid') {
    return (
      <Wrapper color={theme.errorText} onClick={onEditRepository}>
        <StyledTooltip
          title={t('Re-check your App Store Credentials')}
          containerDisplayMode="inline-flex"
        >
          <IconWarning size="sm" />
        </StyledTooltip>
        {t('Authentication required')}
      </Wrapper>
    );
  }

  if (pendingDownloads) {
    return (
      <Wrapper color={theme.textColor}>
        <IconWrapper>
          <IconDownload size="sm" />
        </IconWrapper>
        {tn('%s build pending', '%s builds pending', pendingDownloads)}
      </Wrapper>
    );
  }

  if (lastCheckedBuilds) {
    return (
      <Wrapper color={theme.textColor}>
        <IconWrapper>
          <IconRefresh size="sm" />
        </IconWrapper>
        <TimeSince date={lastCheckedBuilds} />
      </Wrapper>
    );
  }

  return null;
}

export default Status;

const Wrapper = styled('div')<{color: string}>`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(0.75)};
  color: ${p => p.color};
  font-size: ${p => p.theme.fontSizeMedium};
  height: 14px;
  ${p => p.onClick && `cursor: pointer`};
`;

const StyledTooltip = styled(Tooltip)`
  margin-top: -5px;
  height: 14px;
`;

const IconWrapper = styled('div')`
  margin-top: -5px;
  height: 14px;
`;
