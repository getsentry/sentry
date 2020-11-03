import React from 'react';

import {t} from 'app/locale';
import {Project, Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import Placeholder from 'app/components/placeholder';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

import ReleaseLandingCard from './releaseLandingCard';

function Illustration({children}: {children: React.ReactNode}) {
  return <React.Suspense fallback={<Placeholder />}>{children}</React.Suspense>;
}

const IllustrationContributors = React.lazy(
  () =>
    import(
      /* webpackChunkName: "IllustrationContributors" */ './illustrations/contributors'
    )
);
const IllustrationSuggestedAssignees = React.lazy(
  () =>
    import(
      /* webpackChunkName: "IllustrationSuggestedAssignees" */ './illustrations/suggestedAssignees'
    )
);
const IllustrationIssues = React.lazy(
  () => import(/* webpackChunkName: "IllustrationIssues" */ './illustrations/issues')
);
const IllustrationMinified = React.lazy(
  () => import(/* webpackChunkName: "IllustrationMinified" */ './illustrations/minified')
);
const IllustrationEmails = React.lazy(
  () => import(/* webpackChunkName: "IllustrationEmails" */ './illustrations/emails')
);

const cards = [
  {
    title: t("You Haven't Set Up Releases!"),
    disclaimer: t('(you made no releases in 30 days)'),
    message: t(
      'Releases provide additional context, with rich commits, so you know which errors were addressed and which were introduced in a release'
    ),
    svg: (
      <Illustration>
        <IllustrationContributors />
      </Illustration>
    ),
  },
  {
    title: t('Suspect Commits'),
    message: t(
      'Sentry suggests which commit caused an issue and who is likely responsible so you can triage'
    ),
    svg: (
      <Illustration>
        <IllustrationSuggestedAssignees />
      </Illustration>
    ),
  },
  {
    title: t('Release Stats'),
    message: t(
      'See the commits in each release, and which issues were introduced or fixed in the release'
    ),
    svg: (
      <Illustration>
        <IllustrationIssues />
      </Illustration>
    ),
  },
  {
    title: t('Easy Resolution'),
    message: t(
      'Automatically resolve issues by including the issue number in your commit message'
    ),
    svg: (
      <Illustration>
        <IllustrationMinified />
      </Illustration>
    ),
  },
  {
    title: t('Deploy Emails'),
    message: t('Receive email notifications when your code gets deployed'),
    svg: (
      <Illustration>
        <IllustrationEmails />
      </Illustration>
    ),
  },
];

type ReleaseLandingProps = {
  organization: Organization;
  project: Project;
};

type State = {
  stepId: number;
};

const ReleaseLanding = withOrganization(
  withProject(
    class ReleaseLanding extends React.Component<ReleaseLandingProps, State> {
      state = {
        stepId: 0,
      };

      componentDidMount() {
        const {organization, project} = this.props;

        analytics('releases.landing_card_viewed', {
          org_id: parseInt(organization.id, 10),
          project_id: project && parseInt(project.id, 10),
        });
      }

      handleClick = () => {
        const {stepId} = this.state;
        const {organization, project} = this.props;

        const title = cards[stepId].title;
        if (stepId >= cards.length - 1) {
          return;
        }
        this.setState(state => ({
          stepId: state.stepId + 1,
        }));

        analytics('releases.landing_card_clicked', {
          org_id: parseInt(organization.id, 10),
          project_id: project && parseInt(project.id, 10),
          step_id: stepId,
          step_title: title,
        });
      };

      getCard = stepId => cards[stepId];

      render() {
        const {stepId} = this.state;
        const card = this.getCard(stepId);

        return (
          <ReleaseLandingCard
            onClick={this.handleClick}
            card={card}
            step={stepId}
            cardsLength={cards.length}
          />
        );
      }
    }
  )
);

export default ReleaseLanding;
