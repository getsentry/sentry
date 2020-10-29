import React from 'react';
import PropTypes from 'prop-types';
import {withInfo} from '@storybook/addon-info';
import {Router, browserHistory, Route} from 'react-router';

import StreamGroup from 'app/components/stream/group';
import GroupStore from 'app/stores/groupStore';

export default {
  title: 'Features/Issues/Stream Group',
};

const selection = {
  projects: [1],
  environments: ['production', 'staging'],
  datetime: {
    start: '2019-10-09T11:18:59',
    end: '2019-09-09T11:18:59',
    period: '',
    utc: true,
  },
};
const organization = {
  id: '1',
  slug: 'test-org',
  features: [],
};
const group = {
  assignedTo: null,
  count: '327482',
  culprit: 'fetchData(app/components/group/suggestedOwners/suggestedOwners)',
  firstRelease: null,
  firstSeen: '2020-10-05T19:44:05.963Z',
  hasSeen: false,
  id: '1',
  isBookmarked: false,
  isPublic: false,
  isSubscribed: false,
  lastSeen: '2020-10-11T01:08:59Z',
  level: 'warning',
  logger: null,
  metadata: {function: 'fetchData', type: 'RequestError'},
  numComments: 0,
  permalink: 'https://foo.io/organizations/foo/issues/1234/',
  platform: 'javascript',
  project: {
    platform: 'javascript',
    id: 1,
    slug: 'test-project',
  },
  shareId: null,
  shortId: 'JAVASCRIPT-6QS',
  stats: {
    '24h': [
      [1517281200, 2],
      [1517310000, 1],
    ],
    '30d': [
      [1514764800, 1],
      [1515024000, 122],
    ],
  },
  status: 'unresolved',
  title: 'RequestError: GET /issues/ 404',
  type: 'error',
  userCount: 35097,
  userReportCount: 0,
};

class LocationContext extends React.Component {
  static childContextTypes = {
    location: PropTypes.object,
  };

  getChildContext() {
    return {location: {query: {}}};
  }

  render() {
    return (
      <Router history={browserHistory}>
        <Route path="/*" component={() => this.props.children} />
      </Router>
    );
  }
}

export const Default = withInfo('default')(() => {
  const unhandledGroup = {
    ...group,
    id: '2',
    culprit: 'sentry.tasks.email.send_email',
    isUnhandled: true,
    level: 'error',
    count: '12',
    userCount: 1337,
    metadata: {
      function: 'send_messages',
      type: 'SMTPServerDisconnected',
      value: 'Connection unexpectedly closed',
      filename: 'sentry/utils/email.py',
    },
    annotations: ['<a href="https://sentry.io">PROD-72</a>'],
    title: 'UnhandledError: GET /issues/ 404',
  };

  const resolvedGroup = {
    ...group,
    id: '3',
    status: 'resolved',
    isUnhandled: true,
    metadata: {function: 'fetchData', type: 'ResolvedError'},
    numComments: 2,
  };

  const ignoredGroup = {
    ...group,
    id: '4',
    status: 'ignored',
    culprit: 'culprit',
    metadata: {function: 'fetchData', type: 'IgnoredErrorType'},
  };

  const bookmarkedGroup = {
    ...group,
    id: '5',
    metadata: {
      function: 'send_messages',
      type: 'BookmarkedError',
      value: 'Connection unexpectedly closed',
      filename: 'sentry/utils/email.py',
    },
    culprit: '',
    isBookmarked: true,
    logger: 'sentry.incidents.tasks',
  };

  GroupStore.loadInitialData([
    group,
    unhandledGroup,
    resolvedGroup,
    ignoredGroup,
    bookmarkedGroup,
  ]);
  return (
    <LocationContext>
      <StreamGroup
        id={group.id}
        canSelect
        withChart={null}
        memberList={[]}
        organization={organization}
        selection={selection}
        query=""
        isGlobalSelectionReady
      />

      <StreamGroup
        id={unhandledGroup.id}
        canSelect
        withChart={null}
        memberList={[]}
        organization={organization}
        selection={selection}
        query=""
        isGlobalSelectionReady
      />

      <StreamGroup
        id={resolvedGroup.id}
        canSelect
        withChart={null}
        memberList={[]}
        organization={organization}
        selection={selection}
        query=""
        isGlobalSelectionReady
      />

      <StreamGroup
        id={ignoredGroup.id}
        canSelect
        withChart={null}
        memberList={[]}
        organization={organization}
        selection={selection}
        query=""
        isGlobalSelectionReady
      />

      <StreamGroup
        id={bookmarkedGroup.id}
        canSelect
        withChart={null}
        memberList={[]}
        organization={organization}
        selection={selection}
        query=""
        isGlobalSelectionReady
      />
    </LocationContext>
  );
});
