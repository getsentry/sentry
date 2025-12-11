import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';
import {ActionSection, MaxWidthPanel, PanelDescription, StepContent} from './common';

export function NextStepsStep() {
  const {selectedCodeReviewRepositories, selectedRootCauseAnalysisRepositories} =
    useSeerOnboardingContext();

  const organization = useOrganization();
  const totalRepositories = new Set([
    ...selectedCodeReviewRepositories.map(repo => repo.id),
    ...selectedRootCauseAnalysisRepositories.map(repo => repo.id),
  ]).size;

  return (
    <Fragment>
      <StepContent>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <Text bold>{t('Congratulations, you’ve finished setting up Seer!')}</Text>
              <p>
                {t(
                  'For connected projects and repos, you will now be able to have Seer:'
                )}
              </p>
              <NextStepsList>
                <li>Do AI Code Review</li>
                <li>Perform root cause analysis on your issues and propose fixes</li>
                <li>Make PRs on new issues</li>
              </NextStepsList>
              <Text>
                {tct(
                  'If you want to adjust your configurations, you can modify them on the [settings:Seer Settings Page], or configure [projects:projects] and [repos:repos] individually. ',
                  {
                    settings: <Link to={`/settings/${organization.slug}/seer/`} />,
                    projects: (
                      <Link to={`/settings/${organization.slug}/seer/projects/`} />
                    ),
                    repos: <Link to={`/settings/${organization.slug}/seer/repos/`} />,
                  }
                )}
              </Text>
            </PanelDescription>
            <PanelDescription>
              <Flex direction="column" gap="md">
                <Text bold>{t('Predicted spend')}</Text>
                <Text>
                  {t(`Based on the activity in your Seer-connected repositories
              over the last month, this is an estimate of what you would owe at the end of
              your trial:`)}
                </Text>
                <Well>
                  <WellContent>
                    <CellTitle>{t('Connected Repos')}</CellTitle>
                    <Text>{totalRepositories}</Text>
                  </WellContent>
                  <WellContent>
                    <CellTitle>{t('Active Contributors')}</CellTitle>
                    <Text>??</Text>
                  </WellContent>
                  <WellContent>
                    <CellTitle>{t('Predicted Spend')}</CellTitle>
                    <Text>$4,000</Text>
                  </WellContent>
                </Well>
              </Flex>
            </PanelDescription>
          </PanelBody>
        </MaxWidthPanel>

        <ActionSection>
          <LinkButton
            priority="primary"
            size="md"
            to={`/organizations/${organization.slug}/issues/`}
          >
            {t('Finish')}
          </LinkButton>
        </ActionSection>
      </StepContent>
    </Fragment>
  );
}

const NextStepsList = styled('ul')`
  margin: ${p => p.theme.space.xl} 0;
`;

const Well = styled(Flex)`
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
`;
const WellContent = styled(Flex)`
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.lg};

  &:last-child {
    border-right: none;
  }
`;
const CellTitle = styled(Text)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-transform: uppercase;
`;
