import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/actions/button';
import ButtonBar from 'app/components/buttonBar';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {buttonText: string; docsUrl: string} & Pick<
  React.ComponentProps<typeof Button>,
  'disabled' | 'onClick'
>;

export default function FooterWithButtons({buttonText, docsUrl, ...rest}: Props) {
  return (
    <Footer>
      <StyledButtonBar gap={1}>
        <StyledButton external href={docsUrl} size="small">
          {t('View Docs')}
        </StyledButton>
        <StyledButton priority="primary" type="submit" size="small" {...rest}>
          {buttonText}
        </StyledButton>
      </StyledButtonBar>
    </Footer>
  );
}

//wrap in form so we can keep form submission behavior
const Footer = styled('form')`
  width: 100%;
  position: fixed;
  display: flex;
  justify-content: flex-end;
  bottom: 0;
  z-index: 100;
  background-color: ${p => p.theme.bodyBackground};
  border-top: 1px solid ${p => p.theme.gray100};
`;

const StyledButtonBar = styled(ButtonBar)`
  padding: ${space(2)};
`;

const StyledButton = styled(Button)`
  padding: 0;
`;
