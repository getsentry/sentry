import {useMemo} from 'react';
import styled from '@emotion/styled';

import {FlamegraphZoomView} from 'sentry/components/flamegraph/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/flamegraph/flamegraphZoomViewMinimap';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {PROFILE} from 'sentry/utils/profiling/example';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {LightFlamegraphTheme as flamegraphTheme} from 'sentry/utils/profiling/flamegraph/FlamegraphTheme';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {};

function ProfilingContent(_props: Props) {
  const organization = useOrganization();
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);

  const flamegraph = new Flamegraph(PROFILE, 0);

  return (
    <SentryDocumentTitle title={t('Profiling')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <StyledPageContent>
          <NoProjectMessage organization={organization}>
            <Layout.Header>
              <PageHeading>{t('Profiling')}</PageHeading>
            </Layout.Header>
            <StyledBody>
              <Layout.Main fullWidth>
                <Wrapper>
                  <FlamegraphZoomViewMinimap
                    canvasPoolManager={canvasPoolManager}
                    flamegraph={flamegraph}
                    flamegraphTheme={flamegraphTheme}
                    colorCoding="by symbol name"
                    highlightRecursion={false}
                  />
                  <FlamegraphZoomView
                    canvasPoolManager={canvasPoolManager}
                    flamegraph={flamegraph}
                    flamegraphTheme={flamegraphTheme}
                  />
                </Wrapper>
              </Layout.Main>
            </StyledBody>
          </NoProjectMessage>
        </StyledPageContent>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default ProfilingContent;

const StyledPageContent = styled(PageContent)`
  padding: 0px;
`;

const StyledBody = styled(Layout.Body)`
  grid-template-rows: 1fr;
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-rows: 100px 1fr;
  height: 100%;
`;
