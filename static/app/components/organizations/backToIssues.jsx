import styled from 'react-emotion';
import {Link} from 'react-router';
import space from 'app/styles/space';

const BackToIssues = styled(Link)`
  color: ${p => p.theme.gray4};
  background: ${p => p.theme.offWhite2};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
  width: ${space(1.5)};
  height: ${space(1.5)};
  border-radius: 50%;
  box-sizing: content-box;
  margin: 0 -${space(2)} 0 ${space(2)};
  position: relative;
  z-index: 1;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  &:hover {
    background: ${p => p.theme.offwhite};
    transform: scale(1.125);
  }
`;

export default BackToIssues;
