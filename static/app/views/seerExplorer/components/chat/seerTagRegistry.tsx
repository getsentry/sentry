import type {ReactNode} from 'react';
import type {z} from 'zod';

import {DateTime} from 'sentry/components/dateTime';
import {TimeSince} from 'sentry/components/timeSince';

import {SEER_TAG_SCHEMAS, type SeerTagName} from './seerTags';

type SeerTagComponent<N extends SeerTagName> = (props: {
  attrs: z.infer<(typeof SEER_TAG_SCHEMAS)[N]['schema']>;
}) => ReactNode;

const SEER_TAG_COMPONENTS: {[N in SeerTagName]: SeerTagComponent<N>} = {
  timestamp({attrs}) {
    if (attrs.format === 'relative') {
      return <TimeSince date={attrs.value} />;
    }
    return <DateTime date={attrs.value} />;
  },
};

export function renderSeerTag(
  name: string,
  attrs: Record<string, string>
): ReactNode | null {
  if (!(name in SEER_TAG_SCHEMAS)) {
    return null;
  }
  const tagName = name as SeerTagName;
  const {schema} = SEER_TAG_SCHEMAS[tagName];
  const parsed = schema.safeParse(attrs);
  if (!parsed.success) {
    return null;
  }
  const Component = SEER_TAG_COMPONENTS[tagName];
  return <Component attrs={parsed.data} />;
}
