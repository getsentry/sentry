import type {ReactNode} from 'react';

import type {Event} from 'sentry/types/event';
import type {TagWithTopValues} from 'sentry/types/group';
import type {Environment, Project} from 'sentry/types/project';

export type TagFacetsProps = {
  environments: Environment[];
  groupId: string;
  project: Project;
  tagKeys: string[];
  event?: Event;
  tagFormatter?: (
    tagsData: Record<string, TagWithTopValues>
  ) => Record<string, TagWithTopValues>;
  title?: ReactNode;
};
