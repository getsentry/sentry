import React from 'react';
import posed, {PoseGroup} from 'react-pose';

import {analytics} from 'app/utils/analytics';
import {stepPropTypes} from 'app/views/onboarding/onboarding';
import {t} from 'app/locale';
import HookOrDefault from 'app/components/hookOrDefault';
import SentryTypes from 'app/sentryTypes';
import testablePose from 'app/utils/testablePose';
import withOrganization from 'app/utils/withOrganization';

import InviteMembers from './inviteMembers';
import LearnMore from './learnMore';
import ProjectDocs from './projectDocs';
import SetupChoices from './setupChoices';

const recordAnalyticsOptionSelected = ({organization, choice}) =>
  analytics('onboarding_v2.setup_choice_selected', {
    org_id: parseInt(organization.id, 10),
    choice,
  });

// Member invitation works a bit differently in Sentry's SaaS product, this
// provides a hook for that.
const InviteMembersComponent = HookOrDefault({
  hookName: 'onboarding:invite-members',
  defaultComponent: InviteMembers,
});

const SETUP_CHOICES = [
  {
    id: 'install-guide',
    title: t('Installation Guide'),
    component: ProjectDocs,
  },
  {
    id: 'invite-members',
    title: t('Invite Team Members'),
    component: InviteMembersComponent,
  },
  {
    id: 'learn-more',
    title: t('Take a Tour'),
    component: LearnMore,
  },
];

const DEFAULT_SETUP_OPTION = 'install-guide';

class OnboardingProjectSetup extends React.Component {
  static propTypes = {
    ...stepPropTypes,
    organization: SentryTypes.Organization,
  };

  state = {
    selectedChoice: DEFAULT_SETUP_OPTION,
  };

  handleSelect = id => {
    const {organization} = this.props;
    this.setState({selectedChoice: id});
    recordAnalyticsOptionSelected({organization, choice: id});
  };

  render() {
    const {selectedChoice} = this.state;
    const SelectedComponent = SETUP_CHOICES.find(item => item.id === selectedChoice)
      .component;

    // NOTE: We give the PoseGroup different enter/exit/init poses than default
    // so that when poses propagate down to children they do not animate enter
    // or exit when switching setup choices.
    return (
      <React.Fragment>
        <SetupChoices
          choices={SETUP_CHOICES}
          selectedChoice={selectedChoice}
          onSelect={this.handleSelect}
        />
        <PoseGroup
          withParent={false}
          preEnterPose="choiceInit"
          enterPose="choiceEnter"
          exitPose="choiceExit"
        >
          <PosedChoice key={selectedChoice}>
            <SelectedComponent {...this.props} />
          </PosedChoice>
        </PoseGroup>
      </React.Fragment>
    );
  }
}

const PosedChoice = posed.div(
  testablePose({
    choiceInit: {opacity: 0, x: -20},
    choiceEnter: {opacity: 1, x: 0},
    choiceExit: {opacity: 0, x: 20},
  })
);

export default withOrganization(OnboardingProjectSetup);
