import styled from '@emotion/styled';

import Button from 'app/components/actions/button';
import LogoSentry from 'app/components/logoSentry';
import {t} from 'app/locale';
import space from 'app/styles/space';

export default function HeaderWithHelp({docsUrl}: {docsUrl: string}) {
  return (
    <Header>
      <StyledLogoSentry />
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

const StyledLogoSentry = styled(LogoSentry)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;
