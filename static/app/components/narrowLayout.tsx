import {useEffect} from 'react';
import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

type Props = {
  children: React.ReactNode;
  maxWidth?: string;
  showLogout?: boolean;
};

function NarrowLayout({maxWidth, showLogout, children}: Props) {
  const api = useApi();

  useEffect(() => {
    document.body.classList.add('narrow');

    return () => document.body.classList.remove('narrow');
  }, []);

  async function handleLogout() {
    await logout(api);
    window.location.assign('/auth/login');
  }

  return (
    <div className="app">
      <div className="pattern-bg" />
      <div className="container" style={{maxWidth}}>
        <div className="box box-modal">
          <div className="box-header">
            <a href="/">
              <IconSentry size="lg" />
            </a>
            {showLogout && (
              <a className="logout pull-right" onClick={handleLogout}>
                <Logout>{t('Sign out')}</Logout>
              </a>
            )}
          </div>
          <div className="box-content with-padding">{children}</div>
        </div>
      </div>
    </div>
  );
}

const Logout = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

export default NarrowLayout;
