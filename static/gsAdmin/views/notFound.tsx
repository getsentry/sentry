import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function NotFound() {
  return (
    <SplashWrapper>
      <Header>
        <HeaderTitle>{t('Not Found')}</HeaderTitle>
      </Header>
      <div>
        <strong>{t('Page not found.')}</strong>
      </div>
    </SplashWrapper>
  );
}

const SplashWrapper = styled('div')`
  padding: ${space(3)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  margin: ${space(4)} 0;
`;
const HeaderTitle = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: normal;
  color: ${p => p.theme.textColor};
`;

export default NotFound;
