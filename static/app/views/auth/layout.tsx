import {useEffect} from 'react';
import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import {IconSentry} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {AppBodyContent} from 'sentry/views/app/appBodyContent';

const BODY_CLASSES = ['narrow'];

/**
 * Shared auth layout structure - includes all wrapper elements.
 */
function AuthLayoutContent({children}: {children: React.ReactNode}) {
  useEffect(() => {
    document.body.classList.add(...BODY_CLASSES);
    return () => document.body.classList.remove(...BODY_CLASSES);
  }, []);

  return (
    <div className="app">
      <AppBodyContent>
        <AuthContainer>
          <div className="pattern-bg" />
          <AuthPanel>
            <AuthSidebar>
              <SentryButton />
            </AuthSidebar>
            <div>{children}</div>
          </AuthPanel>
        </AuthContainer>
      </AppBodyContent>
    </div>
  );
}

/**
 * Route component for auth pages.
 * Uses <Outlet /> for child routes.
 */
export default function AuthLayout() {
  return (
    <AuthLayoutContent>
      <Outlet />
    </AuthLayoutContent>
  );
}

/**
 * Wrapper component for auth-style layout with children to render.
 */
export function AuthLayoutWrapper({children}: {children: React.ReactNode}) {
  return <AuthLayoutContent>{children}</AuthLayoutContent>;
}

const AuthContainer = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 5vh;
`;

const AuthPanel = styled(Panel)`
  min-width: 550px;
  display: inline-grid;
  grid-template-columns: 60px 1fr;
`;

const AuthSidebar = styled('div')`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: ${space(3)};
  border-radius: ${p => p.theme.radius.md} 0 0 ${p => p.theme.radius.md};
  margin: -1px;
  margin-right: 0;
  background: #564f64;
  background-image: linear-gradient(
    -180deg,
    rgba(52, 44, 62, 0) 0%,
    rgba(52, 44, 62, 0.5) 100%
  );
`;

const SentryButton = styled(
  (p: Omit<React.ComponentPropsWithoutRef<typeof Link>, 'to'>) => (
    <Link to="/" {...p}>
      <IconSentry size="lg" />
    </Link>
  )
)`
  color: #fff;

  &:hover,
  &:focus {
    color: #fff;
  }
`;
