import styled from '@emotion/styled';

import coverageImgDark from 'sentry-images/features/coverage-dark-mode.svg';
import coverageImgLight from 'sentry-images/features/coverage-light-mode.svg';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import * as Layout from 'sentry/components/layouts/thirds';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useOrganization from 'sentry/utils/useOrganization';
import {COVERAGE_PAGE_TITLE} from 'sentry/views/prevent/settings';

const INSTRUCTIONS_TEXT = {
  header: t('Get Started by installing the GitHub Sentry App'),
  subtext: t(
    "You need to install the Sentry App on your GitHub organization as an admin. If you're not an admin, you will need to make sure your GitHub organization admins approve the installation of the Sentry App on GitHub."
  ),
  mainCTA: t('Add installation'),
  mainCTALink: 'https://github.com/apps/sentry-io',
} as const;

export default function TestsPreOnboardingPage() {
  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();
  const isDarkMode = config.theme === 'dark';

  return (
    <SentryDocumentTitle title={COVERAGE_PAGE_TITLE} orgSlug={organization.slug}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Flex align="center" justify="between" direction="row">
            <Layout.Title>
              {COVERAGE_PAGE_TITLE}
              <FeatureBadge type="new" />
            </Layout.Title>
          </Flex>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main width="full">
          <LayoutGap>
            <Panel>
              <IntroSection>
                <ImgContainer>
                  <img src={isDarkMode ? coverageImgDark : coverageImgLight} />
                </ImgContainer>
                <StyledDiv>
                  <h2>{t('Catch Coverage Gaps Before They Become Issues')}</h2>
                  <SpacedParagraph>
                    {t(
                      'See coverage for your whole codebase and identify untested code.'
                    )}
                  </SpacedParagraph>
                  <ul>
                    <li>{t('See which lines of code are not covered by tests')}</li>
                    <li>
                      {t('Set and enforce code coverage standards.')}{' '}
                      <ExternalLink href="https://docs.sentry.io/product/test-analytics/">
                        {t('Learn more')}
                      </ExternalLink>
                    </li>
                  </ul>
                </StyledDiv>
              </IntroSection>
            </Panel>
            <Panel>
              <InstructionsSection>
                <h2>{INSTRUCTIONS_TEXT.header}</h2>
                <SubtextParagraph>{INSTRUCTIONS_TEXT.subtext}</SubtextParagraph>
                <Flex gap="xl">
                  <LinkButton
                    external
                    priority="primary"
                    href={INSTRUCTIONS_TEXT.mainCTALink}
                  >
                    {INSTRUCTIONS_TEXT.mainCTA}
                  </LinkButton>
                  <LinkButton priority="default" href="/settings/integrations/github">
                    Learn more
                  </LinkButton>
                </Flex>
              </InstructionsSection>
            </Panel>
          </LayoutGap>
        </Layout.Main>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}

const IntroSection = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 90px;
  min-height: 300px;
  max-width: 1000px;
  margin: 0 auto;
  padding: 44px 40px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    padding: ${p => p.theme.space['2xl']} 40px;
    flex-wrap: wrap;
  }

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    gap: 0;
  }
`;

const ImgContainer = styled('div')`
  flex: 0 0 418px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    text-align: center;
    flex: 1 0 100%;
  }
`;

const StyledDiv = styled('div')`
  flex: 1;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex: 1 0 100%;
    margin-top: ${p => p.theme.space['2xl']};
  }
`;

const SpacedParagraph = styled('p')`
  margin-bottom: ${p => p.theme.space.md};
`;

const LayoutGap = styled('div')`
  display: grid;
  gap: ${p => p.theme.space.xl};
`;

const InstructionsSection = styled('div')`
  display: flex;
  flex-direction: column;
  padding: 24px 40px;
`;

const SubtextParagraph = styled('p')`
  max-width: 1000px;
`;
