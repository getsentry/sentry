import styled from 'react-emotion';
import {Link} from 'react-router';
import space from 'app/styles/space';

const BackToIssues = styled(Link)`
  display: flex;
  width: ${space(1.5)};
  height: ${space(1.5)};
  align-items: center;
  justify-content: center;

  box-sizing: content-box;
  padding: ${space(1)};
  border-radius: 50%;

  color: ${p => p.theme.gray4};
  background: ${p => p.theme.offWhite2};
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  z-index: 1;

  &:hover {
    background: ${p => p.theme.offwhite};
    transform: scale(1.125);
  }
`;

export default BackToIssues;
