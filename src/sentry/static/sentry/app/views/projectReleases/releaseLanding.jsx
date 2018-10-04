import React from 'react';
import {t} from 'app/locale';
import {
  BashCard,
  Issues,
  SuggestedAssignees,
  Emails,
  Contributors,
} from 'sentry-dreamy-components';
import ReleaseLandingCard from 'app/views/projectReleases/releaseLandingCard';
import withApi from 'app/utils/withApi.jsx';

const cards = [
  {
    title: t("You Haven't Set Up Releases!"),
    message: t(
      'Releases provide additional context, with rich commits, so you know which errors were addressed and which were introduced for the first time'
    ),
    component: Contributors,
  },
  {
    title: t('Suspect Commits'),
    message: t(
      'Sentry suggests which commit caused an issue and who is likely responsible so you can triage'
    ),
    component: SuggestedAssignees,
  },
  {
    title: t('Release Stats'),
    message: t(
      'Set the commits in each release, and which issues were introduced or fixed in the release.'
    ),
    component: Issues,
  },
  {
    title: t('Easy Resolution'),
    message: t(
      'Automatically resolve issues by including the issue number in your commit message.'
    ),
    component: BashCard,
  },
  {
    title: t('Deploy Emails'),
    message: t('Receive email notifications when your code gets deployed.'),
    component: Emails,
  },
];

const ReleaseLanding = withApi(
  class ReleaseLanding extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        stepId: 0,
      };
    }

    handleClick = () => {
      let {stepId} = this.state;

      if (stepId >= cards.length - 1) return;
      this.setState(state => ({
        stepId: state.stepId + 1,
      }));
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
