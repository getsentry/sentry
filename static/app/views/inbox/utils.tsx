import type {ComponentType} from 'react';
import {IconIssues} from '@sentry/icons/issues';
import {IconSeer} from '@sentry/icons/seer';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

import {t} from 'sentry/locale';

import type {
  InboxEventType,
  InboxFilters,
  InboxRecipient,
  InboxSubjectType,
} from './types';

interface InboxSubjectConfig {
  icon: ComponentType<SVGIconProps>;
  label: string;
}

export const INBOX_SUBJECT_CONFIG: Record<InboxSubjectType, InboxSubjectConfig> = {
  issue: {icon: IconIssues, label: t('Issue')},
  notebook: {icon: IconSeer, label: t('Investigation')},
};

interface InboxEventTypeConfig {
  label: string;
  subjectType: InboxSubjectType;
}

export const INBOX_EVENT_TYPE_CONFIG: Record<InboxEventType, InboxEventTypeConfig> = {
  'issue.user_assigned': {label: t('Issue assigned to you'), subjectType: 'issue'},
  'issue.team_assigned': {label: t('Issue assigned to your team'), subjectType: 'issue'},
  'issue.user_mentioned': {label: t('Issue mentioned you'), subjectType: 'issue'},
  'issue.team_mentioned': {label: t('Issue mentioned your team'), subjectType: 'issue'},
  'issue.pr_ready_for_review': {
    label: t('Issue pull request ready for review'),
    subjectType: 'issue',
  },
  'notebook.completed': {label: t('Investigation completed'), subjectType: 'notebook'},
  'notebook.user_mentioned': {
    label: t('Investigation mentioned you'),
    subjectType: 'notebook',
  },
  'notebook.team_mentioned': {
    label: t('Investigation mentioned your team'),
    subjectType: 'notebook',
  },
  'notebook.participant_added': {
    label: t('Investigation added as participant'),
    subjectType: 'notebook',
  },
};

export const INBOX_RECIPIENT_LABELS: Record<InboxRecipient, string> = {
  team: t('Team'),
  user: t('User'),
};

export function hasInboxFilters(filters: InboxFilters) {
  return (
    filters.subjectType.length > 0 ||
    filters.eventType.length > 0 ||
    filters.recipient.length > 0
  );
}
