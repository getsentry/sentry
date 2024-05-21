import startCase from 'lodash/startCase';

import type {ContextValue} from 'sentry/components/events/contexts';
import {
  getContextMeta,
  getContextTitle,
  getFormattedContextData,
} from 'sentry/components/events/contexts/utils';
import * as KeyValueData from 'sentry/components/keyValueData/card';
import type {Event, Group, KeyValueListDataItem, Project} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

interface ContextCardProps {
  alias: string;
  event: Event;
  type: string;
  group?: Group;
  project?: Project;
  value?: ContextValue;
}

interface ContextCardContentConfig {
  // Omit error styling from being displayed, even if context is invalid
  disableErrors?: boolean;
  // Displays tag value as plain text, rather than a hyperlink if applicable
  disableRichValue?: boolean;
  // Includes the Context Type as a prefix to the key. Useful if displaying a single Context key
  // apart from the rest of that Context. E.g. 'Email' -> 'User: Email'
  includeAliasInSubject?: boolean;
}

export interface ContextCardContentProps {
  item: KeyValueListDataItem;
  meta: Record<string, any>;
  alias?: string;
  config?: ContextCardContentConfig;
}

export function ContextCardContent({
  item,
  alias,
  meta,
  config,
  ...props
}: ContextCardContentProps) {
  const {key: contextKey, subject} = item;
  if (contextKey === 'type') {
    return null;
  }
  const contextMeta = meta?.[contextKey];
  const contextErrors = contextMeta?.['']?.err ?? [];
  const contextSubject =
    config?.includeAliasInSubject && alias ? `${startCase(alias)}: ${subject}` : subject;

  return (
    <KeyValueData.Content
      item={{...item, subject: contextSubject}}
      meta={contextMeta}
      errors={config?.disableErrors ? [] : contextErrors}
      disableRichValue={config?.disableRichValue ?? false}
      {...props}
    />
  );
}

export default function ContextCard({
  alias,
  event,
  type,
  project,
  value = {},
}: ContextCardProps) {
  const organization = useOrganization();
  if (objectIsEmpty(value)) {
    return null;
  }
  const meta = getContextMeta(event, type);

  const contextItems = getFormattedContextData({
    event,
    contextValue: value,
    contextType: type,
    organization,
    project,
  });

  const contentItems = contextItems.map<KeyValueData.ContentProps>(item => {
    const itemMeta: KeyValueData.ContentProps['meta'] = meta?.[item?.key];
    const itemErrors: KeyValueData.ContentProps['errors'] = itemMeta?.['']?.err ?? [];
    return {
      item,
      meta: itemMeta,
      errors: itemErrors,
    };
  });

  return (
    <KeyValueData.Card
      contentItems={contentItems}
      title={getContextTitle({alias, type, value})}
    />
  );
}
