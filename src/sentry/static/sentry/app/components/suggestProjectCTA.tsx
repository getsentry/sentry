import React from 'react';

import {Organization, Project} from 'app/types';
import {EntryRequest, Event} from 'app/types/event';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import withProjects from 'app/utils/withProjects';

const MOBILE_PLATFORMS = [
  'android',
  'csharp',
  'cocoa',
  'cocoa-swift',
  'apple-ios',
  'swift',
  'flutter',
];

const MOBILE_USER_AGENTS = ['okhttp/', 'CFNetwork/', 'Alamofire/', 'Dalvik/'];

type Props = {
  projects: Project[];
  event: Event;
  organization: Organization;
};

class SuggestProjectCTA extends React.Component<Props> {
  componentDidMount() {
    const matchedUserAgentString = this.matchedUserAgentString;
    trackAdvancedAnalyticsEvent(
      'growth.check_show_mobile_prompt_banner',
      {
        matchedUserAgentString,
        userAgentMatches: !!matchedUserAgentString,
        hasMobileProject: this.hasMobileProject,
        snoozedOrDismissed: false, //TODO: update when snooze/dismissed implemented
      },
      this.props.organization,
      {startSession: true}
    );
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
  get hasMobileProject() {
    return this.props.projects.some(project =>
      MOBILE_PLATFORMS.includes(project.platform || '')
    );
  }

  render() {
    //TODO(Steve): implement UI
    return null;
  }
}

export default withProjects(SuggestProjectCTA);
