import {ReactNode} from 'react';

import {Environment, TagWithTopValues} from 'sentry/types';
import {Event} from 'sentry/types/event';

export type TagFacetsProps = {
  environments: Environment[];
  groupId: string;
  tagKeys: string[];
  event?: Event;
  tagFormatter?: (
    tagsData: Record<string, TagWithTopValues>
  ) => Record<string, TagWithTopValues>;
  title?: ReactNode;
};
