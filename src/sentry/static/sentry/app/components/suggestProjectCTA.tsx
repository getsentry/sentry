import React from 'react';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import SuggestProjectModal from 'app/components/modals/suggestProjectModal';
import {IconClose, IconUpgrade} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {EntryRequest, Event} from 'app/types/event';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import {promptIsDismissed} from 'app/utils/promptIsDismissed';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

const MOBILE_PLATFORMS = [
  'react-native',
  'android',
  'cordova',
  'cocoa',
  'cocoa-swift',
  'apple-ios',
  'swift',
  'flutter',
  'xamarin',
  'dotnet-xamarin',
];

const MOBILE_USER_AGENTS = [
  'okhttp/',
  'CFNetwork/',
  'Alamofire/',
  'Dalvik/',
  'node-fetch',
];

type Props = {
  projects: Project[];
  event: Event;
  organization: Organization;
  api: Client;
};

type State = {
  isDismissed?: boolean;
  promptIsLoaded?: boolean;
};

class SuggestProjectCTA extends React.Component<Props, State> {
  state: State = {};
  componentDidMount() {
    this.openModal();
    this.fetchData();
  }

  //Returns the matched user agent string
  //otherwise, returns an empty string
  get matchedUserAgentString() {
    const {entries} = this.props.event;
    const requestEntry = entries.find(item => item.type === 'request');
    if (!requestEntry) {
      return '';
    }
    const userAgent = (requestEntry as EntryRequest)?.data?.headers?.find(
      item => item[0].toLowerCase() === 'user-agent'
    );
    if (!userAgent) {
      return '';
    }
    return (
      MOBILE_USER_AGENTS.find(mobileAgent =>
        userAgent[1]?.toLowerCase().includes(mobileAgent.toLowerCase())
      ) ?? ''
    );
  }
  //check our projects to see if there is a mobile project
  get hasMobileProject() {
    return this.props.projects.some(project =>
      MOBILE_PLATFORMS.includes(project.platform || '')
    );
  }

  get showCTA() {
    const {promptIsLoaded, isDismissed} = this.state;
    /**
     * conditions to show prompt:
     * 1. User agent matches mobile
     * 2. No mobile project
     * 3. CTA is not dimissed
     * 4. We've loaded the data from the backend for the prompt
     */
    return (
      !!this.matchedUserAgentString &&
      !this.hasMobileProject &&
      !isDismissed &&
      promptIsLoaded
    );
  }

  async fetchData() {
    const {api, organization} = this.props;

    //check our prompt backend
    const promptData = await promptsCheck(api, {
      organizationId: organization.id,
      feature: 'suggest_mobile_project',
    });
    const isDismissed = promptIsDismissed(promptData);

    //set the new state
    this.setState({
      isDismissed,
      promptIsLoaded: true,
    });

    const matchedUserAgentString = this.matchedUserAgentString;

    //now record the results
    trackAdvancedAnalyticsEvent(
      'growth.check_show_mobile_prompt_banner',
      {
        matchedUserAgentString,
        userAgentMatches: !!matchedUserAgentString,
        hasMobileProject: this.hasMobileProject,
        snoozedOrDismissed: isDismissed,
      },
      this.props.organization,
      {startSession: true}
    );
  }

  handleCTAClose = () => {
    const {api, organization} = this.props;
    trackAdvancedAnalyticsEvent(
      'growth.dismissed_mobile_prompt_banner',
      {},
      this.props.organization
    );

    promptsUpdate(api, {
      organizationId: organization.id,
      feature: 'suggest_mobile_project',
      status: 'dismissed',
    });

    this.setState({isDismissed: true});
  };

  openModal = () => {
    trackAdvancedAnalyticsEvent(
      'growth.dismissed_mobile_prompt_banner',
      {
        matchedUserAgentString: this.matchedUserAgentString,
      },
      this.props.organization
    );
    openModal(deps => (
      <SuggestProjectModal organization={this.props.organization} {...deps} />
    ));
  };

  renderCTA() {
    return (
      <Alert icon={<IconUpgrade onClick={this.openModal} />} type="info">
        <Content>
          {t(
            'We have a sneaky suspicion you have a mobile app that doesn’t use Sentry. Let’s start monitoring.'
          )}
          <StyledIconClose onClick={this.handleCTAClose} />
        </Content>
      </Alert>
    );
  }

  render() {
    return this.showCTA ? this.renderCTA() : null;
  }
}

export default withApi(withProjects(SuggestProjectCTA));

const Content = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1)};
`;

const StyledIconClose = styled(IconClose)`
  margin: auto;
`;
