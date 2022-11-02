import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

type Props = {
  platform: string;
};

const StacktracePlatformIcon = ({platform}: Props) => (
  <StyledPlatformIcon
    platform={platform}
    size="20px"
    radius={null}
    data-test-id={`platform-icon-${platform}`}
  />
);

const StyledPlatformIcon = styled(PlatformIcon)`
  position: absolute;
  top: -1px;
  left: -20px;
  border-radius: 3px 0 0 3px;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;

export default StacktracePlatformIcon;
