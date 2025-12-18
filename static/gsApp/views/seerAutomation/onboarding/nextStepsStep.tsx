import {Fragment} from 'react';
import styled from '@emotion/styled';

import nextStepsImg from 'sentry-images/spot/seer-config-bug-2.svg';

import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import PanelBody from 'sentry/components/panels/panelBody';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {ActionSection, MaxWidthPanel, PanelDescription, StepContent} from './common';

export function NextStepsStep() {
  const organization = useOrganization();

  return (
    <Fragment>
      <StepContentWithBackground>
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
                <li>Review your PRs and catch bugs before you ship them to production</li>
                <li>Perform root cause analysis on your issues and propose solutions</li>
                <li>Create PRs to fix issues</li>
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
          </PanelBody>
        </MaxWidthPanel>

        <ActionSection>
          <LinkButton
            priority="primary"
            size="md"
            to={`/settings/${organization.slug}/seer/`}
          >
            {t('Finish')}
          </LinkButton>
        </ActionSection>
      </StepContentWithBackground>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${nextStepsImg}) no-repeat 638px 0;
  background-size: 233px 212px;
`;

const NextStepsList = styled('ul')`
  margin: ${p => p.theme.space.xl} 0;
`;
