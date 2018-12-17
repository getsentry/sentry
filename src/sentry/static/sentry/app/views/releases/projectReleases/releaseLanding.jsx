import React from 'react';
import {t} from 'app/locale';
import styled from 'react-emotion';

import {
  BashCard,
  Issues,
  SuggestedAssignees,
  Emails,
  Contributors,
} from 'sentry-dreamy-components';

import {analytics} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

import ReleaseLandingCard from './releaseLandingCard';

const StyledSuggestedAssignees = styled(SuggestedAssignees)`
  width: 150px;
  height: 150px;
  padding-left: 250px;
`;

const cards = [
  {
    title: t("You Haven't Set Up Releases!"),
    message: t(
      'Releases provide additional context, with rich commits, so you know which errors were addressed and which were introduced in a release'
    ),
    component: Contributors,
  },
  {
    title: t('Suspect Commits'),
    message: t(
      'Sentry suggests which commit caused an issue and who is likely responsible so you can triage'
    ),
    component: StyledSuggestedAssignees,
  },
  {
    title: t('Release Stats'),
    message: t(
      'See the commits in each release, and which issues were introduced or fixed in the release'
    ),
    component: Issues,
  },
  {
    title: t('Easy Resolution'),
    message: t(
      'Automatically resolve issues by including the issue number in your commit message'
    ),
    component: BashCard,
  },
  {
    title: t('Deploy Emails'),
    message: t('Receive email notifications when your code gets deployed'),
    component: Emails,
  },
];

const ReleaseLanding = withApi(
  class ReleaseLanding extends React.Component {
    static contextTypes = {
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
    };

    constructor(props) {
      super(props);
      this.state = {
        stepId: 0,
      };
    }

    componentDidMount() {
      let {organization, project} = this.context;
      analytics('releases.landing_card_viewed', {
        org_id: parseInt(organization.id, 10),
        project_id: parseInt(project.id, 10),
      });
    }

    handleClick = () => {
      let {stepId} = this.state;
      let {organization, project} = this.context;

      let title = cards[stepId].title;
      if (stepId >= cards.length - 1) return;
      this.setState(state => ({
        stepId: state.stepId + 1,
      }));

      analytics('releases.landing_card_clicked', {
        org_id: parseInt(organization.id, 10),
        project_id: parseInt(project.id, 10),
        step_id: stepId,
        step_title: title,
      });
    };

    getCard = stepId => {
      return cards[stepId];
    };

    render() {
      let {stepId} = this.state;
      let card = this.getCard(stepId);

      return (
        <div className="container">
          <div className="row">
            <ReleaseLandingCard
              onClick={this.handleClick}
              card={card}
              step={stepId}
              cardsLength={cards.length}
            />
          </div>
        </div>
      );
    }
  }
);

export default ReleaseLanding;
