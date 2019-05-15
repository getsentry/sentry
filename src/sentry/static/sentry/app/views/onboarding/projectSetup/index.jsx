import React from 'react';
import posed, {PoseGroup} from 'react-pose';
import styled from 'react-emotion';

import {t} from 'app/locale';
import HookOrDefault from 'app/components/hookOrDefault';
import InlineSvg from 'app/components/inlineSvg';
import Tooltip2 from 'app/components/tooltip2';

import InviteMembers from './inviteMembers';
import LearnMore from './learnMore';
import ProjectDocs from './projectDocs';
import SetupChoices from './setupChoices';

const ChoiceStar = styled(p => (
  <Tooltip2 title={t('Recommended next step')}>
    <InlineSvg src="icon-star-small-filled" {...p} />
  </Tooltip2>
))`
  position: absolute;
  top: 10px;
  right: 10px;
  color: ${p => p.theme.yellow};
`;

const SETUP_CHOICES = [
  {
    id: 'install_guide',
    title: t('Installation Guide'),
    icon: 'icon-window',
    extra: <ChoiceStar />,
    subtext: t(
      `Ready to copy and paste some code? Looking for a quick overview of the
       setup process? You'll be sending errors in only a few minutes!`
    ),
  },
  {
    id: 'invite_members',
    title: t('Invite Team Members'),
    icon: 'icon-user-multi',
    subtext: t(
      `Not sure how to integrate Sentry into your code, but know someone on
       your team who does? Teamwork makes the dream work. Invite your
       teammates.`
    ),
  },
  {
    id: 'learn_more',
    title: t('How Does Sentry Work?'),
    icon: 'icon-discover',
    subtext: t(
      `Still not sure how Sentry can integrate into your workflow? Take a quick
       tour around the product to learn about common Sentry workflows.`
    ),
  },
];

// Member invitation works a bit differently in Sentry's SaaS product, this
// provides a hook for that.
const InviteMembersComponent = HookOrDefault({
  hookName: 'onboarding:invite-members',
  defaultComponent: InviteMembers,
});

const SETUP_COMPONENTS = {
  install_guide: ProjectDocs,
  invite_members: InviteMembersComponent,
  learn_more: LearnMore,
};

const DEFAULT_SETUP_OPTION = 'install_guide';

class OnboardingProjectSetup extends React.Component {
  state = {
    selectedChoice: DEFAULT_SETUP_OPTION,
  };

  handleSelect = id => this.setState({selectedChoice: id});

  render() {
    const {selectedChoice} = this.state;
    const SelectedComponent = SETUP_COMPONENTS[selectedChoice];

    // NOTE: We give the PoseGroup different enter/exit/init poses than default
    // so that when poses propegate down to children they do not animate enter
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

const PosedChoice = posed.div({
  choiceInit: {opacity: 0, x: -20},
  choiceEnter: {opacity: 1, x: 0},
  choiceExit: {opacity: 0, x: 20},
});

export default OnboardingProjectSetup;
