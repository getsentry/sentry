import styled from '@emotion/styled';

import testsAnalyticsSummaryDark from 'sentry-images/features/test-analytics-summary-dark.svg';
import testsAnalyticsSummary from 'sentry-images/features/test-analytics-summary.svg';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import useOrganization from 'sentry/utils/useOrganization';

const INSTRUCTIONS_TEXT = {
  header: t('Get Started by installing the GitHub Sentry App'),
  subtext: t(
    "You need to install the Sentry App on your GitHub organization as an admin. If you're not an admin, you will need to make sure your GitHub organization admins approve the installation of the Sentry App on GitHub."
  ),
  mainCTA: t('Add installation'),
  mainCTALink: '/settings/integrations/github',
} as const;

export default function TestPreOnboardingPage() {
  const organization = useOrganization();
  const regionData = getRegionDataFromOrganization(organization);
  const isUSStorage = regionData?.name === 'us';

  const config = useLegacyStore(ConfigStore);
  const isDarkMode = config.theme === 'dark';

  return (
    <LayoutGap>
      {!isUSStorage && (
        <Alert.Container>
          <Alert type="info">
            {t(
              'Test Analytics data is stored in the U.S. only. To use this feature, create a new Sentry organization with U.S. data storage.'
            )}
          </Alert>
        </Alert.Container>
      )}
      <Panel>
        <IntroSection>
          <ImgContainer>
            <img src={isDarkMode ? testsAnalyticsSummaryDark : testsAnalyticsSummary} />
          </ImgContainer>
          <StyledDiv>
            <h2>{t('Keep test problems from slowing you down')}</h2>
            <SpacedParagraph>
              {t('Get testing data that keeps your CI running smoothly')}
            </SpacedParagraph>
            <ul>
              <li>{t('See which lines of code failed which tests')}</li>
              <li>
                {t('Get confirmation of flaky tests and confidently skip or re-run them')}
              </li>
              <li>
                {t('Identify the most problematic tests and prioritize fixes.')}{' '}
                <Link to="https://docs.sentry.io/product/test-analytics/">
                  {t('Learn more')}
                </Link>
              </li>
            </ul>
          </StyledDiv>
        </IntroSection>
      </Panel>
      {isUSStorage && (
        <Panel>
          <InstructionsSection>
            <h2>{INSTRUCTIONS_TEXT.header}</h2>
            <SubtextParagraph>{INSTRUCTIONS_TEXT.subtext}</SubtextParagraph>
            <ButtonBar>
              <LinkButton priority="primary" href={INSTRUCTIONS_TEXT.mainCTA}>
                {INSTRUCTIONS_TEXT.mainCTA}
              </LinkButton>
              <LinkButton priority="default" href="/settings/integrations/github">
                Learn more
              </LinkButton>
            </ButtonBar>
          </InstructionsSection>
        </Panel>
      )}
    </LayoutGap>
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

const ButtonBar = styled('div')`
  display: flex;
  gap: ${p => p.theme.space.xl};
`;

const SubtextParagraph = styled('p')`
  max-width: 1000px;
`;
