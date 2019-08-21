import React from 'react';
import PropTypes from 'prop-types';
import {t} from 'app/locale';
import styled from 'react-emotion';

import minified from 'sentry-dreamy-components/dist/minified.svg';
import emails from 'sentry-dreamy-components/dist/emails.svg';
import issues from 'sentry-dreamy-components/dist/issues.svg';
import suggestedAssignees from 'sentry-dreamy-components/dist/suggested-assignees.svg';
import contributors from 'sentry-dreamy-components/dist/contributors.svg';

import {analytics} from 'app/utils/analytics';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

import ReleaseLandingCard from './releaseLandingCard';

class Illustration extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    const {data} = this.props;

    // Currently, we need a fallback because object doesn't work in msedge,
    // and img doesn't work in safari. Hopefully we can choose one soon.
    return (
      <ObjectIllustration type="image/svg+xml" data={data}>
        <ImgIllustration type="image/svg+xml" src={data} />
      </ObjectIllustration>
    );
  }
}

const ObjectIllustration = styled('object')`
  width: 100%;
  height: 100%;
`;

const ImgIllustration = styled('img')`
  width: 100%;
  height: 100%;
`;

const cards = [
  {
    title: t("You Haven't Set Up Releases!"),
    message: t(
      'Releases provide additional context, with rich commits, so you know which errors were addressed and which were introduced in a release'
    ),
    svg: <Illustration data={contributors} />,
  },
  {
    title: t('Suspect Commits'),
    message: t(
      'Sentry suggests which commit caused an issue and who is likely responsible so you can triage'
    ),
    svg: <Illustration data={suggestedAssignees} />,
  },
  {
    title: t('Release Stats'),
    message: t(
      'See the commits in each release, and which issues were introduced or fixed in the release'
    ),
    svg: <Illustration data={issues} />,
  },
  {
    title: t('Easy Resolution'),
    message: t(
      'Automatically resolve issues by including the issue number in your commit message'
    ),
    svg: <Illustration data={minified} />,
  },
  {
    title: t('Deploy Emails'),
    message: t('Receive email notifications when your code gets deployed'),
    svg: <Illustration data={emails} />,
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
      const {organization, project} = this.context;
      analytics('releases.landing_card_viewed', {
        org_id: parseInt(organization.id, 10),
        project_id: project && parseInt(project.id, 10),
      });
    }

    handleClick = () => {
      const {stepId} = this.state;
      const {organization, project} = this.context;

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

    getCard = stepId => {
      return cards[stepId];
    };

    render() {
      const {stepId} = this.state;
      const card = this.getCard(stepId);

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
