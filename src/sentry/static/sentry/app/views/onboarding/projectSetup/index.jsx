import React from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import {stepPropTypes} from 'app/views/onboarding/onboarding';
import {t} from 'app/locale';
import HookOrDefault from 'app/components/hookOrDefault';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import testableTransition from 'app/utils/testableTransition';

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

    return (
      <React.Fragment>
        <SetupChoices
          choices={SETUP_CHOICES}
          selectedChoice={selectedChoice}
          onSelect={this.handleSelect}
        />
        <ChoiceContainer>
          <AnimatePresence>
            <Choices key={selectedChoice}>
              <SelectedComponent {...this.props} />
            </Choices>
          </AnimatePresence>
        </ChoiceContainer>
      </React.Fragment>
    );
  }
}

const ChoiceContainer = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
`;

const Choices = styled(motion.div)`
  grid-column: 1;
  grid-row: 1;
`;

Choices.defaultProps = {
  transition: testableTransition(),
  initial: {opacity: 0, x: -20},
  animate: {opacity: 1, x: 0},
  exit: {opacity: 0, x: 20},
};

export default withOrganization(OnboardingProjectSetup);
