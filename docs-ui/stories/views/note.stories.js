import {Component, useState} from 'react';
import {action} from '@storybook/addon-actions';

import Note from 'sentry/components/activity/note';
import SentryTypes from 'sentry/sentryTypes';
import ConfigStore from 'sentry/stores/configStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const user = {
  username: 'billy@sentry.io',
  identities: [],
  id: '1',
  name: 'billy',
  dateJoined: '2019-03-09T06:52:42.836Z',
  avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
  email: 'billy@sentry.io',
};

const activity = {id: '123', data: {text: 'hello'}, dateCreated: new Date()};

ConfigStore.set('user', {...user, isSuperuser: true, options: {}});
ProjectsStore.loadInitialData([
  {
    id: '2',
    slug: 'project-slug',
    name: 'Project Name',
    hasAccess: true,
    isMember: true,
    isBookmarked: false,
    teams: [
      {
        id: '1',
        slug: 'team-slug',
        name: 'Team Name',
        isMember: true,
        memberCount: 0,
      },
    ],
  },
]);
MemberListStore.loadInitialData([
  {
    username: 'doug@sentry.io',
    id: '2',
    name: 'doug',
    dateJoined: '2019-03-09T06:52:42.836Z',
    avatar: {avatarUuid: null, avatarType: 'letter_avatar'},
    email: 'doug@sentry.io',
  },
]);

const organization = {
  id: '1',
  slug: 'org-slug',
  access: ['project:releases'],
};

class OrganizationContext extends Component {
  static childContextTypes = {
    organization: SentryTypes.Organization,
  };

  getChildContext() {
    return {organization};
  }

  render() {
    return this.props.children;
  }
}

export default {
  title: 'Views/Activity/Activity Note',
  component: Note,
};

export const Default = () => {
  const [text, setText] = useState(activity.data.text);

  return (
    <OrganizationContext>
      <Note
        showTime
        authorName={user.name}
        user={user}
        text={text}
        modelId={activity.id}
        dateCreated={activity.dateCreated}
        projectSlugs={['project-slug']}
        minHeight={200}
        onUpdate={(...props) => {
          action('Updated item', props);
          setText(props[0].text);
        }}
        onDelete={action('Deleted item')}
      />
    </OrganizationContext>
  );
};

Default.storyName = 'Note';
Default.parameters = {
  docs: {
    description: {
      story:
        'A `<Note>` is an `<ActivityItem>` that can be edited with an editor. The editor has an input mode and a preview mode.',
    },
  },
};
