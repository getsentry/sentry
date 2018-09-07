import styled from 'react-emotion';
import {Flex} from 'grid-emotion';
import {keyframes} from 'emotion';

import space from 'app/styles/space';

export const PlaceholderText = styled.div`
  color: ${p => p.theme.gray6};
  font-size: 15px;
`;

export const Heading = styled.h2`
  font-size: 20px;
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;

export const Fieldset = styled.fieldset`
  margin: ${space(3)} ${space(4)};
`;

export const SelectListItem = styled(Flex)`
  margin-top: ${space(0.5)};
`;

export const SidebarLabel = styled.label`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray3};
`;

export const AddText = styled.span`
  font-style: italic;
  text-decoration: underline;
  margin-left: 4px;
  font-size: 13px;
  line-height: 16px;
  color: ${p => p.theme.gray1};
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

export const ButtonSpinner = styled.div`
  animation: ${spin} 0.4s linear infinite;
  width: 14px;
  height: 14px;
  border-radius: 14px;
  border-top: 2px solid ${p => p.theme.borderLight};
  border-right: 2px solid ${p => p.theme.borderLight};
  border-bottom: 2px solid ${p => p.theme.borderLight};
  border-left: 2px solid ${p => p.theme.purple};
  margin-left: 4px;
`;
