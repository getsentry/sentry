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
      <ButtonBar gap={1}>
        <Button external href={docsUrl} size="xsmall">
          {t('View Docs')}
        </Button>
        <Button priority="primary" type="submit" size="xsmall" {...rest}>
          {buttonText}
        </Button>
      </ButtonBar>
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
  padding: ${space(2)};
`;
