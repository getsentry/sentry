import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useReplayPageview from 'sentry/utils/replays/hooks/useReplayPageview';
import useOrganization from 'sentry/utils/useOrganization';
import useAllMobileProj from 'sentry/views/replays/detail/useAllMobileProj';
import ListContent from 'sentry/views/replays/list/listContent';
import ReplayTabs from 'sentry/views/replays/tabs';

const ReplayListPageHeaderHook = HookOrDefault({
  hookName: 'component:replay-list-page-header',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

function ReplaysListContainer() {
  useReplayPageview('replay.list-time-spent');
  const organization = useOrganization();
  const {allMobileProj} = useAllMobileProj();
  const mobileBetaOrg = organization.features.includes('mobile-replay-beta-orgs');

  return (
    <SentryDocumentTitle title={`Session Replay — ${organization.slug}`}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Session Replay')}
            <PageHeadingQuestionTooltip
              title={t(
                'A view of available video-like reproductions of user sessions so you can visualize repro steps to debug issues faster.'
              )}
              docsUrl="https://docs.sentry.io/product/session-replay/"
            />
          </Layout.Title>
        </Layout.HeaderContent>
        <div /> {/* wraps the tabs below the page title */}
        <ReplayTabs selected="replays" />
      </Layout.Header>
      <PageFiltersContainer>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LayoutGap>
              <ReplayListPageHeaderHook />
              {allMobileProj && mobileBetaOrg ? (
                <StyledAlert icon={<IconInfo />} showIcon>
                  {tct(
                    `[strong:Mobile Replay is now generally available.] Since you participated in the beta, will have a two month grace period of free usage, until March 6. After that, you will be billed for [link:additional replays not included in your plan].`,
                    {
                      strong: <strong />,
                      link: (
                        <ExternalLink href="https://docs.sentry.io/pricing/#replays-pricing" />
                      ),
                    }
                  )}
                </StyledAlert>
              ) : null}
              <ListContent />
            </LayoutGap>
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const StyledAlert = styled(Alert)`
  margin: 0;
`;

export default ReplaysListContainer;
