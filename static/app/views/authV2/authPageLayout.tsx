import {Fragment, type ReactNode} from 'react';
import {useLocation, useOutlet} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconSentry} from '@sentry/icons/sentry';
import {AnimatePresence, motion} from 'framer-motion';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {InitialLoadingIndicator} from 'sentry/components/initialLoadingIndicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';

import {AuthPageLoadingProvider} from './useAuthPageLoading';

interface AuthPageLayoutProps {
  children: (slots: {
    content: ReactNode;
    header: ReactNode;
    isLoading: boolean;
  }) => ReactNode;
  isArtworkLoading?: boolean;
}

/** Keeps the route mounted during preparation so it can report when it is ready. */
export function AuthPageLayout({
  children,
  isArtworkLoading = false,
}: AuthPageLayoutProps) {
  const theme = useTheme();
  const location = useLocation();
  const outlet = useOutlet();
  const pageKey = location.pathname.split('/').slice(0, 3).join('/');

  return (
    <AuthPageLoadingProvider>
      {isPageLoading => {
        const isLoading = isPageLoading || isArtworkLoading;

        return (
          <Fragment>
            <Container
              visibility={isLoading ? 'hidden' : 'visible'}
              pointerEvents={isLoading ? 'none' : 'auto'}
              aria-hidden={isLoading}
            >
              {children({
                header: <IconSentry size="xl" />,
                isLoading,
                content: (
                  <AnimatePresence initial={false} mode="wait">
                    <MotionAuthContent
                      key={pageKey}
                      height="100%"
                      align="center"
                      justify="between"
                      gap="2xl"
                      initial={{opacity: 0, x: -20}}
                      animate={{opacity: 1, x: 0}}
                      exit={{opacity: 0, x: 20}}
                      transition={theme.motion.framer.smooth.moderate}
                    >
                      {outlet}
                    </MotionAuthContent>
                  </AnimatePresence>
                ),
              })}
            </Container>
            {isLoading && (
              <Flex
                position="fixed"
                inset="0"
                align="center"
                justify="center"
                background="primary"
              >
                <InitialLoadingIndicator
                  fallback={<LoadingIndicator style={{margin: 0}} />}
                />
              </Flex>
            )}
          </Fragment>
        );
      }}
    </AuthPageLoadingProvider>
  );
}

const AuthContent = styled(Stack)`
  padding-top: 18vh;
`;

const MotionAuthContent = motion.create(AuthContent);
