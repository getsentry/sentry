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
  noOrgs: {
    header: t('Get Started by installing the GitHub Sentry App'),
    subtext: t(
      "You need to install the Sentry App on your GitHub organization as an admin. If you're not an admin, you will need to make sure your GitHub organization admins approve the installation of the Sentry App on GitHub."
    ),
    mainCTA: t('Add installation'),
    mainCTALink: 'https://github.com/apps/sentry-io',
  },
  hasOrgs: {
    header: t('Request Updated Permissions on your Integrated Organization'),
    subtext: t(
      "Sentry is requesting updated permissions access to your integrated organization(s). Admin required. If you're not an admin, reach out to your organization's owner to update the Sentry app permissions."
    ),
    mainCTA: t('Review permissions'),
    // TODO: can we get the xxx installation id? it is unique to each signed in GH user
    mainCTALink: '/settings/installations/xxxx/permissions/update',
  },
};

// TODO: this should come from the backend
const HAS_INTEGRATED_ORGS = false;

export default function TestPreOnboardingPage() {
  const organization = useOrganization();
  const instructionSet = HAS_INTEGRATED_ORGS
    ? INSTRUCTIONS_TEXT.hasOrgs
    : INSTRUCTIONS_TEXT.noOrgs;

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
                <Link to="https://docs.codecov.com/docs/test-analytics">
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
            <h2>{instructionSet.header}</h2>
            <SubtextParagraph>{instructionSet.subtext}</SubtextParagraph>
            <ButtonBar>
              <LinkButton priority="primary" href={instructionSet.mainCTA}>
                {instructionSet.mainCTA}
              </LinkButton>
              <LinkButton priority="default" href="/settings/integrations/github">
                Learn more
              </LinkButton>
            </ButtonBar>
            <PrerequisitesSection>
              <PrerequisitesTitle>
                {t('Prerequisites to connect your GitHub organization:')}
              </PrerequisitesTitle>
              <Prerequisites>
                <Prereq>
                  <PrereqMainText>
                    {t('Enable GitHub as an Auth Provider')}
                  </PrereqMainText>
                  <PrereqSubText>
                    {t(
                      "Sentry Prevent analyzes your code through your Git provider. You'll need to authenticate to access data from your organizations."
                    )}
                  </PrereqSubText>
                </Prereq>
                <Prereq>
                  <PrereqMainText>{t('Install the GitHub Sentry App')}</PrereqMainText>
                  <PrereqSubText>
                    <Link to="https://github.com/apps/sentry-io">
                      {t('Install the app')}
                    </Link>
                    {t(
                      " on your GitHub org in your Sentry org. You will need to be an Owner of your GitHub organization to fully configure the integration. Note: Once linked, a GitHub org/account can't be connected to another Sentry org."
                    )}
                  </PrereqSubText>
                </Prereq>
                <Prereq>
                  <PrereqMainText>
                    {t('Connect your GitHub identities in Sentry')}
                  </PrereqMainText>
                  <PrereqSubText>
                    {t('In your Sentry ')}
                    <Link to="https://sentry.io/settings/account/identities">
                      {t('identities')}
                    </Link>
                    {t(
                      " settings, link your GitHub account to your profile. If you're having trouble adding the integration, "
                    )}
                    <Link to="https://sentry.io/settings/account/identities">
                      {t('disconnect')}
                    </Link>
                    {t(' then ')}
                    {/* TODO: figma file links to https://sentry.io/auth/login/?next=/auth/sso/account/settings/social/associate/co[…]D6ee6a67e71b4459e8e4c%26state%3D7nJAqWF3l4bkczXAPzTcfo8EKIvSHyiB
                        but not sure how to get the link to that currently */}
                    <Link to="">{t('reconnect')}</Link>
                    {t(' your GitHub identity.')}
                  </PrereqSubText>
                </Prereq>
              </Prerequisites>
            </PrerequisitesSection>
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

const PrerequisitesSection = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: 24px;
  padding-top: ${p => p.theme.space['2xl']};
`;

const Prerequisites = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  padding: 24px;
  border: 1px solid ${p => p.theme.border};
  border-radius: 10px;
  margin-bottom: ${p => p.theme.space.lg};
  gap: ${p => p.theme.space.lg};
`;

const Prereq = styled('div')`
  margin-bottom: ${p => p.theme.space.lg};
  max-width: 1000px;
`;

const PrerequisitesTitle = styled('p')`
  font-size: 16px;
`;

const PrereqMainText = styled('p')`
  font-weight: 600;
  margin: 0;
`;

const PrereqSubText = styled('p')`
  font-weight: 400;
  margin: 0;
`;
