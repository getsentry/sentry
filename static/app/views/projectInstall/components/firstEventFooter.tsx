import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import FirstEventIndicator from 'sentry/views/onboarding/components/firstEventIndicator';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';

interface FirstEventFooterProps {
  docsLink: string;
  organization: Organization;
  project: Project;
  docsOnClick?: () => void;
}

export default function FirstEventFooter({
  organization,
  project,
  docsLink,
  docsOnClick,
}: FirstEventFooterProps) {
  return (
    <Fragment>
      <FirstEventIndicator
        organization={organization}
        project={project}
        eventType="error"
      >
        {({indicator, firstEventButton}) => (
          <CTAFooter>
            <Actions gap={2}>
              {firstEventButton}
              <LinkButton external href={docsLink} onClick={docsOnClick}>
                {t('View full documentation')}
              </LinkButton>
            </Actions>
            {indicator}
          </CTAFooter>
        )}
      </FirstEventIndicator>
      <CTASecondary>
        {tct(
          'Just want to poke around before getting too cozy with the SDK? [sample:View a sample event for this SDK] or [skip:finish setup later].',
          {
            sample: (
              <CreateSampleEventButton
                aria-label={t('View a sample event')}
                project={project}
                source="onboarding"
                priority="link"
              />
            ),
            skip: (
              <LinkButton priority="link" href="/" aria-label={t('Finish setup later')} />
            ),
          }
        )}
      </CTASecondary>
    </Fragment>
  );
}

const CTAFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  margin: ${space(2)} 0;
  margin-top: ${space(4)};
`;

const CTASecondary = styled('p')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  max-width: 500px;
`;

const Actions = styled(ButtonBar)`
  display: inline-grid;
  justify-self: start;
`;
