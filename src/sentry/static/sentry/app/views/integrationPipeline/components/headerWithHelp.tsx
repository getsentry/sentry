import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/actions/button';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';
import space from 'app/styles/space';

export default function HeaderWithHelp({docsUrl}: {docsUrl: string}) {
  return (
    <Header>
      <StyledInlineSvg src="logo" />
      <Button external href={docsUrl} size="xsmall">
        {t('Need Help?')}
      </Button>
    </Header>
  );
}

const Header = styled('div')`
  width: 100%;
  position: fixed;
  display: flex;
  justify-content: space-between;
  top: 0;
  z-index: 100;
  padding: ${space(2)};
  background: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const StyledInlineSvg = styled(InlineSvg)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;
