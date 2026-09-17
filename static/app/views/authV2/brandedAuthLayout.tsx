import {Fragment} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import {AnimatePresence} from 'framer-motion';

import {Container, Flex} from '@sentry/scraps/layout';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import {InitialLoadingIndicator} from 'sentry/components/initialLoadingIndicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';

import {BrandedAuthLoadingProvider} from './useBrandedAuthLoading';

export default function BrandedAuthLayout() {
  const location = useLocation();
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
              <BrandPageLayout.Content>
                <AnimatePresence initial={false} mode="wait">
                  <Outlet key={pageKey} />
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
