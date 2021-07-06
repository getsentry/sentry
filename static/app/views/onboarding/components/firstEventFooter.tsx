import {Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import CreateSampleEventButton from 'app/views/onboarding/createSampleEventButton';

import FirstEventIndicator from './firstEventIndicator';

type Props = {
  organization: Organization;
  project: Project;
  docsLink?: string;
  docsOnClick?: () => void;
};

export default function FirstEventFooter({
  organization,
  project,
  docsLink,
  docsOnClick,
}: Props) {
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
              <Button external href={docsLink} onClick={docsOnClick}>
                {t('View full documentation')}
              </Button>
            </Actions>
            {indicator}
          </CTAFooter>
        )}
      </FirstEventIndicator>
      <CTASecondary>
        {tct(
          'Just want to poke around before getting too cozy with the SDK? [sample:View a sample event for this SDK] and finish setup later.',
          {
            sample: (
              <CreateSampleEventButton
                project={project}
                source="onboarding"
                priority="link"
              />
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
