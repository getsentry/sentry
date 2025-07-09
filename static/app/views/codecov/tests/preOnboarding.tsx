import {css} from '@emotion/react';
import styled from '@emotion/styled';

import testsAnalyticsSummary from 'sentry-images/features/test-analytics-summary.svg';
import testsAnalyticsSummaryDark from 'sentry-images/features/test-analytics-summary-dark.svg';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
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
          <Alert type="info" showIcon>
            {t(
              'Test Analytics data is stored in the U.S. only. To use this feature, create a new Sentry organization with U.S. data storage.'
            )}
          </Alert>
        </Alert.Container>
      )}
      <IntroSection>
        <img src={isDarkMode ? testsAnalyticsSummaryDark : testsAnalyticsSummary} />
        <div>
          <h2>{t('Say Goodbye to Flaky Tests')}</h2>
          <p
            css={css`
              margin-bottom: ${space(1)};
            `}
          >
            {t(
              'Test Analytics offers data on test run times, failure rates, and identifies flaky tests to help decrease the risk of deployment failures and make it easier to ship new features quickly. '
            )}
            <Link to="https://docs.codecov.com/docs/test-analytics">
              {t('Learn more')}
            </Link>
          </p>
          <ItalicP>
            {t(
              'No more staring at failing tests wondering, “Is it me, or is it just flaky?”'
            )}
          </ItalicP>
        </div>
      </IntroSection>
      {isUSStorage && (
        <InstructionsSection>
          <h2>{instructionSet.header}</h2>
          <p>{instructionSet.subtext}</p>
          <ButtonBar>
            <LinkButton priority="primary" redesign href={instructionSet.mainCTA}>
              {instructionSet.mainCTA}
            </LinkButton>
            <LinkButton priority="default" redesign href="/settings/integrations/github">
              Learn more
            </LinkButton>
          </ButtonBar>
          <PrerequisitesSection>
            <PrerequisitesTitle>
              {t('Prerequisites to connect your GitHub organization:')}
            </PrerequisitesTitle>
            <Prerequisites>
              <Prereq>
                <PrereqMainText>{t('Enable GitHub as an Auth Provider')}</PrereqMainText>
                <PrereqSubText>
                  {t(
                    "Sentry Prevent analyzes your code through your Git provider. You'll need to authenticate to access data from your organizations."
                  )}
                </PrereqSubText>
              </Prereq>
              <Prereq>
                <LinkButton
                  priority="default" redesign
                  icon={<IconGithub redesign />}
                  href="https://github.com"
                >
                  {t('Sign in with GitHub')}
                </LinkButton>
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
      )}
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;

const ItalicP = styled('p')`
  font-style: italic;
  color: ${p => p.theme.headingColor};
`;

const IntroSection = styled('div')`
  display: flex;
  border: 1px solid rgba(224, 220, 229, 1);
  border-radius: 10px;
  justify-content: space-around;
  gap: 90px;
  padding: 44px;
  max-width: 800px;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: column;
    align-items: center;
    gap: ${space(3)};
  }
`;

const InstructionsSection = styled('div')`
  display: grid;
  border: 1px solid rgba(224, 220, 229, 1);
  border-radius: 10px;
  padding: 24px 40px;
  max-width: 800px;
`;

const ButtonBar = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const PrerequisitesSection = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: 24px;
  padding-top: ${space(3)};
`;

const Prerequisites = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  padding: 24px;
  border: 1px solid ${p => p.theme.border};
  border-radius: 10px;
  margin-bottom: ${space(1.5)};
  gap: ${space(1.5)};
`;

const Prereq = styled('div')`
  margin-bottom: ${space(1.5)};
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
