import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Project, Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import OnboardingPanel from 'app/components/onboardingPanel';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import FeatureTourModal, {
  TourStep,
  TourImage,
  TourText,
} from 'app/components/modals/featureTourModal';

import emptyStateImg from '../../../../images/spot/releases-empty-state.svg';
import commitImage from '../../../../images/spot/releases-tour-commits.svg';
import statsImage from '../../../../images/spot/releases-tour-stats.svg';
import resolutionImage from '../../../../images/spot/releases-tour-resolution.svg';
import emailImage from '../../../../images/spot/releases-tour-email.svg';

const TOUR_STEPS: TourStep[] = [
  {
    title: t('Suspect Commits'),
    image: <TourImage src={commitImage} />,
    body: (
      <TourText>
        {t(
          'Sentry suggests which commit caused an issue and who is likely responsible so you can triage.'
        )}
      </TourText>
    ),
  },
  {
    title: t('Release Stats'),
    image: <TourImage src={statsImage} />,
    body: (
      <TourText>
        {t(
          'Get an overview of the commits in each release, and which issues were introduced or fixed.'
        )}
      </TourText>
    ),
  },
  {
    title: t('Easily Resolve'),
    image: <TourImage src={resolutionImage} />,
    body: (
      <TourText>
        {t(
          'Automatically resolve issues by including the issue number in your commit message.'
        )}
      </TourText>
    ),
  },
  {
    title: t('Deploy Emails'),
    image: <TourImage src={emailImage} />,
    body: (
      <TourText>
        {t(
          'Receive email notifications about when your code gets deployed. This can be customized in settings.'
        )}
      </TourText>
    ),
  },
];
const setupDocs = 'https://docs.sentry.io/product/releases/';

type ReleaseLandingProps = {
  organization: Organization;
  project: Project;
};

class ReleaseLanding extends React.Component<ReleaseLandingProps> {
  componentDidMount() {
    const {organization, project} = this.props;

    analytics('releases.landing_card_viewed', {
      org_id: parseInt(organization.id, 10),
      project_id: project && parseInt(project.id, 10),
    });
  }

  handleAdvance = (index: number) => {
    const {organization, project} = this.props;

    analytics('releases.landing_card_clicked', {
      org_id: parseInt(organization.id, 10),
      project_id: project && parseInt(project.id, 10),
      step_id: index,
      step_title: TOUR_STEPS[index].title,
    });
  };

  render() {
    return (
      <OnboardingPanel image={<img src={emptyStateImg} />}>
        <h3>{t('Demystify Releases')}</h3>
        <p>
          {t(
            'Did you know how many errors your latest release triggered? We do. And more, too.'
          )}
        </p>
        <ButtonList gap={1}>
          <FeatureTourModal steps={TOUR_STEPS} onAdvance={this.handleAdvance}>
            {({showModal}) => (
              <Button priority="default" onClick={showModal}>
                {t('Take a Tour')}
              </Button>
            )}
          </FeatureTourModal>
          <Button priority="primary" href={setupDocs} external>
            {t('Start Setup')}
          </Button>
        </ButtonList>
      </OnboardingPanel>
    );
  }
}

const ButtonList = styled(ButtonBar)`
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
`;

export default withOrganization(withProject(ReleaseLanding));
