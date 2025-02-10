import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import {
  IconAdd,
  IconAsana,
  IconBitbucket,
  IconChat,
  IconCheckmark,
  IconClose,
  IconCommit,
  IconDelete,
  IconFire,
  IconFlag,
  IconGithub,
  IconGitlab,
  IconGlobe,
  IconGraph,
  IconJira,
  IconLock,
  IconMute,
  IconNext,
  IconPlay,
  IconPrevious,
  IconRefresh,
  IconUnsubscribed,
  IconUser,
} from 'sentry/icons';
import {IconCellSignal} from 'sentry/icons/iconCellSignal';
import {space} from 'sentry/styles/space';
import {
  type Group,
  type GroupActivityCreateIssue,
  type GroupActivitySetPriority,
  GroupActivityType,
} from 'sentry/types/group';
import type {User} from 'sentry/types/user';

interface IconWithDefaultProps {
  Component: React.ComponentType<any> | null;
  defaultProps: {locked?: boolean; type?: string};
  componentFunction?: (
    props: Group['activity'][number]['data'],
    user?: User | null
  ) => React.ComponentType<any>;
  propsFunction?: (props: any) => any;
}

export const groupActivityTypeIconMapping: Record<
  GroupActivityType,
  IconWithDefaultProps
> = {
  [GroupActivityType.NOTE]: {
    Component: IconChat,
    defaultProps: {},
    componentFunction: (_data, user) => {
      return user ? () => <StyledUserAvatar user={user} /> : IconChat;
    },
  },
  [GroupActivityType.SET_RESOLVED]: {Component: IconCheckmark, defaultProps: {}},
  [GroupActivityType.SET_RESOLVED_BY_AGE]: {Component: IconCheckmark, defaultProps: {}},
  [GroupActivityType.SET_RESOLVED_IN_RELEASE]: {
    Component: IconCheckmark,
    defaultProps: {},
  },
  [GroupActivityType.SET_RESOLVED_IN_COMMIT]: {
    Component: IconCheckmark,
    defaultProps: {},
  },
  [GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST]: {
    Component: IconCommit,
    defaultProps: {},
  },
  [GroupActivityType.SET_UNRESOLVED]: {Component: IconClose, defaultProps: {}},
  [GroupActivityType.SET_IGNORED]: {Component: IconMute, defaultProps: {}},
  [GroupActivityType.SET_PUBLIC]: {Component: IconGlobe, defaultProps: {}},
  [GroupActivityType.SET_PRIVATE]: {Component: IconLock, defaultProps: {locked: true}},
  [GroupActivityType.SET_REGRESSION]: {Component: IconFire, defaultProps: {}},
  [GroupActivityType.CREATE_ISSUE]: {
    Component: IconAdd,
    componentFunction: data => {
      const provider = (data as GroupActivityCreateIssue['data']).provider;
      switch (provider) {
        case 'GitHub':
          return IconGithub;
        case 'GitLab':
          return IconGitlab;
        case 'Bitbucket':
          return IconBitbucket;
        case 'Jira':
          return IconJira;
        case 'Asana':
          return IconAsana;
        default:
          return IconAdd;
      }
    },
    defaultProps: {},
  },
  [GroupActivityType.UNMERGE_SOURCE]: {Component: IconPrevious, defaultProps: {}},
  [GroupActivityType.UNMERGE_DESTINATION]: {Component: IconPrevious, defaultProps: {}},
  [GroupActivityType.FIRST_SEEN]: {Component: IconFlag, defaultProps: {}},
  [GroupActivityType.ASSIGNED]: {Component: IconUser, defaultProps: {}},
  [GroupActivityType.UNASSIGNED]: {Component: IconUnsubscribed, defaultProps: {}},
  [GroupActivityType.MERGE]: {Component: IconNext, defaultProps: {}},
  [GroupActivityType.REPROCESS]: {Component: IconRefresh, defaultProps: {}},
  [GroupActivityType.MARK_REVIEWED]: {Component: IconCheckmark, defaultProps: {}},
  [GroupActivityType.AUTO_SET_ONGOING]: {Component: IconPlay, defaultProps: {}},
  [GroupActivityType.SET_ESCALATING]: {
    Component: IconGraph,
    defaultProps: {type: 'area'},
  },
  [GroupActivityType.SET_PRIORITY]: {
    Component: IconCellSignal,
    defaultProps: {},
    propsFunction: data => {
      const {priority} = data as GroupActivitySetPriority['data'];
      switch (priority) {
        case 'high':
          return {bars: 3};
        case 'medium':
          return {bars: 2};
        case 'low':
          return {bars: 1};
        default:
          return {bars: 0};
      }
    },
  },
  [GroupActivityType.DELETED_ATTACHMENT]: {Component: IconDelete, defaultProps: {}},
};

const StyledUserAvatar = styled(UserAvatar)`
  svg {
    margin: ${space(0.25)};
  }
`;
