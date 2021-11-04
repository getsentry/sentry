import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Placeholder from 'app/components/placeholder';
import {areAppStoreConnectCredentialsValid} from 'app/components/projects/appStoreConnectContext/utils';
import TimeSince from 'app/components/timeSince';
import Tooltip from 'app/components/tooltip';
import {IconDownload} from 'app/icons/iconDownload';
import {IconRefresh} from 'app/icons/iconRefresh';
import {IconWarning} from 'app/icons/iconWarning';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';

type Props = {
  onEditRepository: () => void;
  details?: AppStoreConnectValidationData;
};

function Status({details, onEditRepository}: Props) {
  const theme = useTheme();

  if (!details) {
    return <Placeholder height="14px" />;
  }

  const {pendingDownloads, credentials, lastCheckedBuilds} = details ?? {};

  if (areAppStoreConnectCredentialsValid(credentials) === false) {
    return (
      <Wrapper color={theme.red300} onClick={onEditRepository}>
        <StyledTooltip
          title={t('Re-check your App Store Credentials')}
          containerDisplayMode="inline-flex"
        >
          <IconWarning size="sm" />
        </StyledTooltip>
        {t('Credentials are invalid')}
      </Wrapper>
    );
  }

  if (pendingDownloads) {
    return (
      <Wrapper color={theme.gray400}>
        <IconWrapper>
          <IconDownload size="sm" />
        </IconWrapper>
        {tn('%s build pending', '%s builds pending', pendingDownloads)}
      </Wrapper>
    );
  }

  if (lastCheckedBuilds) {
    return (
      <Wrapper color={theme.gray400}>
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
  grid-gap: ${space(0.75)};
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
