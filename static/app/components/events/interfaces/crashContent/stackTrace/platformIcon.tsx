import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

type Props = {
  platform: string;
};

function StacktracePlatformIcon({platform}: Props) {
  const hasStreamlineUi = useHasStreamlinedUI();
  return (
    <StyledPlatformIcon
      platform={platform}
      size={hasStreamlineUi ? '16px' : '20px'}
      radius={null}
      data-test-id={`platform-icon-${platform}`}
    />
  );
}

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: 0;
  left: -${p => p.size};
  border-radius: 3px 0 0 3px;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;

export default StacktracePlatformIcon;
