import {
  IconAdd,
  IconChat,
  IconCheckmark,
  IconClose,
  IconCommit,
  IconDelete,
  IconEdit,
  IconFire,
  IconFlag,
  IconGraph,
  IconLock,
  IconMute,
  IconNext,
  IconPlay,
  IconPrevious,
  IconRefresh,
  IconUnsubscribed,
  IconUser,
} from 'sentry/icons';
import {GroupActivityType} from 'sentry/types/group';

interface IconWithDefaultProps {
  Component: React.ComponentType<any> | null;
  defaultProps: {locked?: boolean; type?: string};
}

export const groupActivityTypeIconMapping: Record<
  GroupActivityType,
  IconWithDefaultProps
> = {
  [GroupActivityType.NOTE]: {Component: IconChat, defaultProps: {}},
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
  [GroupActivityType.SET_PUBLIC]: {Component: IconLock, defaultProps: {}},
  [GroupActivityType.SET_PRIVATE]: {Component: IconLock, defaultProps: {locked: true}},
  [GroupActivityType.SET_REGRESSION]: {Component: IconFire, defaultProps: {}},
  [GroupActivityType.CREATE_ISSUE]: {Component: IconAdd, defaultProps: {}},
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
  [GroupActivityType.SET_PRIORITY]: {Component: IconEdit, defaultProps: {}},
  [GroupActivityType.DELETED_ATTACHMENT]: {Component: IconDelete, defaultProps: {}},
};
