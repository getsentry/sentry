import React from 'react';
import styled from '@emotion/styled';

import minified from 'sentry-dreamy-components/dist/minified.svg';
import emails from 'sentry-dreamy-components/dist/emails.svg';
import issues from 'sentry-dreamy-components/dist/issues.svg';
import suggestedAssignees from 'sentry-dreamy-components/dist/suggested-assignees.svg';
import contributors from 'sentry-dreamy-components/dist/contributors.svg';

import {t} from 'app/locale';
import {Project, Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

import ReleaseLandingCard from './releaseLandingCard';

type IllustrationProps = {
  data: string;
  className?: string;
};

// Currently, we need a fallback because <object> doesn't work in msedge,
// and <img> doesn't work in safari. Hopefully we can choose one soon.
const Illustration = styled(({data, className}: IllustrationProps) => (
  <object data={data} className={className}>
    <img src={data} className={className} />
  </object>
))`
  width: 100%;
  height: 100%;
`;

const cards = [
  {
    title: t("You Haven't Set Up Releases!"),
    disclaimer: t('(you made no releases in 30 days)'),
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
      constructor(props) {
        super(props);
        this.state = {
          stepId: 0,
        };
      }

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
