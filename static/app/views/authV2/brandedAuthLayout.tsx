import {Fragment} from 'react';
import {useLocation, useOutlet} from 'react-router-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import {InitialLoadingIndicator} from 'sentry/components/initialLoadingIndicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSentry} from 'sentry/icons';

import {BrandedAuthLoadingProvider} from './useBrandedAuthLoading';

export default function BrandedAuthLayout() {
  const theme = useTheme();
  const location = useLocation();
  const outlet = useOutlet();
  const pageKey = location.pathname.split('/').slice(0, 3).join('/');

  return (
    <BrandedAuthLoadingProvider>
      {isLoading => (
        <Fragment>
          <Container
            visibility={isLoading ? 'hidden' : 'visible'}
            pointerEvents={isLoading ? 'none' : 'auto'}
            aria-hidden={isLoading}
          >
            <BrandPageLayout isArtworkActive={!isLoading}>
              <BrandPageLayout.HeaderStart>
                <IconSentry size="xl" />
              </BrandPageLayout.HeaderStart>
              <BrandPageLayout.Content>
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
              </BrandPageLayout.Content>
            </BrandPageLayout>
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
      )}
    </BrandedAuthLoadingProvider>
  );
}

const AuthContent = styled(Stack)`
  padding-top: 18vh;
`;

const MotionAuthContent = motion.create(AuthContent);
