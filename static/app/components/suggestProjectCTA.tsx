import {Component} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import SuggestProjectModal from 'app/components/modals/suggestProjectModal';
import {IconClose} from 'app/icons';
import {tct} from 'app/locale';
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

const MOBILE_USER_AGENTS = ['okhttp', 'CFNetwork', 'Alamofire', 'Dalvik'];

type MobileEventResult = {browserName: string; clientOsName: string} | null;

type Props = {
  projects: Project[];
  event: Event;
  organization: Organization;
  api: Client;
};

type State = {
  isDismissed?: boolean;
  loaded?: boolean;
  mobileEventResult?: MobileEventResult;
};

class SuggestProjectCTA extends Component<Props, State> {
  state: State = {};
  componentDidMount() {
    this.fetchData();
  }

  // Returns the matched user agent string
  // otherwise, returns an empty string
  get matchedUserAgentString() {
    const {entries} = this.props.event;
    const requestEntry = entries.find(item => item.type === 'request');
    if (!requestEntry) {
      return '';
    }
    // find the user agent header out of our list of headers
    const userAgent = (requestEntry as EntryRequest)?.data?.headers?.find(
      item => item[0].toLowerCase() === 'user-agent'
    );
    if (!userAgent) {
      return '';
    }
    // check if any of our mobile agent headers matches the event mobile agent
    return (
      MOBILE_USER_AGENTS.find(mobileAgent =>
        userAgent[1]?.toLowerCase().includes(mobileAgent.toLowerCase())
      ) ?? ''
    );
  }

  // check our projects to see if there is a mobile project
  get hasMobileProject() {
    return this.props.projects.some(project =>
      MOBILE_PLATFORMS.includes(project.platform || '')
    );
  }

  // returns true if the current event is mobile from the user agent
  // or if we found a mobile event with the API
  get hasMobileEvent() {
    const {mobileEventResult} = this.state;
    return !!this.matchedUserAgentString || !!mobileEventResult;
  }

  /**
   * conditions to show prompt:
   * 1. Have a mobile event
   * 2. No mobile project
   * 3. CTA is not dimissed
   * 4. We've loaded the data from the backend for the prompt
   */
  get showCTA() {
    const {loaded, isDismissed} = this.state;

    return !!(this.hasMobileEvent && !this.hasMobileProject && !isDismissed && loaded);
  }

  async fetchData() {
    // no need to catch error since we have error boundary wrapping
    const [isDismissed, mobileEventResult] = await Promise.all([
      this.checkMobilePrompt(),
      this.checkOrgHasMobileEvent(),
    ]);

    // set the new state
    this.setState(
      {
        isDismissed,
        mobileEventResult,
        loaded: true,
      },
      () => {
        const matchedUserAgentString = this.matchedUserAgentString;
        if (this.showCTA) {
          // now record the results
          trackAdvancedAnalyticsEvent(
            'growth.show_mobile_prompt_banner',
            {
              matchedUserAgentString,
              mobileEventBrowserName: mobileEventResult?.browserName || '',
              mobileEventClientOsName: mobileEventResult?.clientOsName || '',
            },
            this.props.organization,
            {startSession: true}
          );
        }
      }
    );
  }

  async checkOrgHasMobileEvent(): Promise<MobileEventResult> {
    const {api, organization} = this.props;
    return api.requestPromise(
      `/organizations/${organization.slug}/has-mobile-app-events/`,
      {
        query: {
          userAgents: MOBILE_USER_AGENTS,
        },
      }
    );
  }

  async checkMobilePrompt() {
    const {api, organization} = this.props;

    // check our prompt backend
    const promptData = await promptsCheck(api, {
      organizationId: organization.id,
      feature: 'suggest_mobile_project',
    });
    return promptIsDismissed(promptData);
  }

  handleCTAClose = () => {
    const {api, organization} = this.props;
    trackAdvancedAnalyticsEvent(
      'growth.dismissed_mobile_prompt_banner',
      {
        matchedUserAgentString: this.matchedUserAgentString,
      },
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
      'growth.opened_mobile_project_suggest_modal',
      {
        matchedUserAgentString: this.matchedUserAgentString,
      },
      this.props.organization
    );
    openModal(deps => (
      <SuggestProjectModal
        organization={this.props.organization}
        matchedUserAgentString={this.matchedUserAgentString}
        {...deps}
      />
    ));
  };

  renderCTA() {
    return (
      <Alert type="info">
        <Content>
          <span>
            {tct(
              'We have a sneaking suspicion you have a mobile app that doesn’t use Sentry. [link:Start Monitoring]',
              {link: <a onClick={this.openModal} />}
            )}
          </span>
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
  cursor: pointer;
`;
