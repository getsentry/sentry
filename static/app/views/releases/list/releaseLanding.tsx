import React from 'react';
import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/releases-empty-state.svg';
import commitImage from 'sentry-images/spot/releases-tour-commits.svg';
import emailImage from 'sentry-images/spot/releases-tour-email.svg';
import resolutionImage from 'sentry-images/spot/releases-tour-resolution.svg';
import statsImage from 'sentry-images/spot/releases-tour-stats.svg';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import FeatureTourModal, {
  TourImage,
  TourStep,
  TourText,
} from 'app/components/modals/featureTourModal';
import OnboardingPanel from 'app/components/onboardingPanel';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import AsyncView from 'app/views/asyncView';

const releasesSetupUrl = 'https://docs.sentry.io/product/releases/';

const docsLink = (
  <Button external href={releasesSetupUrl}>
    {t('Setup')}
  </Button>
);

export const RELEASES_TOUR_STEPS: TourStep[] = [
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
    actions: docsLink,
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
    actions: docsLink,
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
    actions: docsLink,
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

type Props = {
  organization: Organization;
  projectId?: number;
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
    const {organization, projectId} = this.props;

    if (this.state.releases.length === 0) {
      return <Promo organization={organization} projectId={projectId} />;
    }

    return <EmptyStateWarning small>{t('There are no releases.')}</EmptyStateWarning>;
  }
}

type PromoProps = {
  organization: Organization;
  projectId?: number;
};

class Promo extends React.Component<PromoProps> {
  componentDidMount() {
    const {organization, projectId} = this.props;

    trackAnalyticsEvent({
      eventKey: 'releases.landing_card_viewed',
      eventName: 'Releases: Landing Card Viewed',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId,
    });
  }

  handleTourAdvance = (step: number, duration: number) => {
    const {organization, projectId} = this.props;

    trackAnalyticsEvent({
      eventKey: 'releases.tour.advance',
      eventName: 'Releases: Tour Advance',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId,
      step,
      duration,
    });
  };

  handleClose = (step: number, duration: number) => {
    const {organization, projectId} = this.props;

    trackAnalyticsEvent({
      eventKey: 'releases.tour.close',
      eventName: 'Releases: Tour Close',
      organization_id: parseInt(organization.id, 10),
      project_id: projectId,
      step,
      duration,
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
          <FeatureTourModal
            steps={RELEASES_TOUR_STEPS}
            onAdvance={this.handleTourAdvance}
            onCloseModal={this.handleClose}
            doneText={t('Start Setup')}
            doneUrl={releasesSetupUrl}
          >
            {({showModal}) => (
              <Button priority="default" onClick={showModal}>
                {t('Take a Tour')}
              </Button>
            )}
          </FeatureTourModal>
          <Button priority="primary" href={releasesSetupUrl} external>
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

export default ReleaseLanding;
