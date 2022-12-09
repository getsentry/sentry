import {ReactNode} from 'react';

import {Environment, Project, TagWithTopValues} from 'sentry/types';
import {Event} from 'sentry/types/event';

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
