import type {ReactNode} from 'react';

import type {Environment, Project, TagWithTopValues} from 'sentry/types';
import type {Event} from 'sentry/types/event';

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
