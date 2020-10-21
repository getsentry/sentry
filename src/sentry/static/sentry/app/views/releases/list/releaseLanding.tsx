import { Component } from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Project, Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import OnboardingPanel from 'app/components/onboardingPanel';
import withProject from 'app/utils/withProject';
import FeatureTourModal, {
  TourStep,
  TourImage,
  TourText,
} from 'app/components/modals/featureTourModal';
import AsyncView from 'app/views/asyncView';
import EmptyStateWarning from 'app/components/emptyStateWarning';

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

type Props = {
  organization: Organization;
  project: Project;
} & AsyncView['props'];

class ReleaseLanding extends AsyncView<Props> {
  // if there are no releases in the last 30 days, we want to show releases promo, otherwise empty message
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {slug} = this.props.organization;

    const query = {
      per_page: 1,
      summaryStatsPeriod: '30d',
    };

    return [['releases', `/organizations/${slug}/releases/`, {query}]];
  }

  renderBody() {
    const {organization, project} = this.props;

    if (this.state.releases.length === 0) {
      return <Promo organization={organization} project={project} />;
    }

    return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
  }
}

type PromoProps = {
  organization: Organization;
  project: Project;
};

class Promo extends Component<PromoProps> {
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

export default withProject(ReleaseLanding);
