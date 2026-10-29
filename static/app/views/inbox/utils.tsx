import {IconIssues} from '@sentry/icons/issues';
import {IconSeer} from '@sentry/icons/seer';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

import type {InboxSubjectType} from 'sentry/views/inbox/types';

interface InboxSubjectTypeIconProps extends SVGIconProps {
  subjectType: InboxSubjectType;
}

export function InboxSubjectTypeIcon({subjectType, ...props}: InboxSubjectTypeIconProps) {
  switch (subjectType) {
    case 'issue':
      return <IconIssues {...props} />;
    case 'notebook':
      return <IconSeer {...props} />;
  }
}
