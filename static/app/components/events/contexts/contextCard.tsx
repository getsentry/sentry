import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import ErrorBoundary from 'sentry/components/errorBoundary';
import type {ContextValue} from 'sentry/components/events/contexts';
import {
  getContextIcon,
  getContextMeta,
  getContextTitle,
  getContextType,
  getFormattedContextData,
} from 'sentry/components/events/contexts/utils';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import type {Event} from 'sentry/types/event';
import type {Group, KeyValueListDataItem} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {useLocation} from 'sentry/utils/useLocation';
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
  // Displays value as plain text, rather than a hyperlink if applicable
  disableLink?: boolean;
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
      disableLink={config?.disableLink ?? false}
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
  const location = useLocation();
  const organization = useOrganization();
  if (isEmptyObject(value)) {
    return null;
  }
  const meta = getContextMeta(event, type === 'default' ? alias : type);

  const contextItems = getFormattedContextData({
    event,
    contextValue: value,
    contextType: getContextType({alias, type}),
    organization,
    project,
    location,
  });

  const contentItems = contextItems.map<KeyValueDataContentProps>(item => {
    const itemMeta: KeyValueDataContentProps['meta'] = meta?.[item?.key];
    const itemErrors: KeyValueDataContentProps['errors'] = itemMeta?.['']?.err ?? [];
    return {
      item,
      meta: itemMeta,
      errors: itemErrors,
    };
  });

  return (
    <KeyValueData.Card
      contentItems={contentItems}
      title={
        <Title>
          <div>{getContextTitle({alias, type, value})}</div>
          <div style={{minWidth: 14}}>
            <ErrorBoundary customComponent={null}>
              {getContextIcon({
                alias,
                type,
                value,
                contextIconProps: {
                  size: 'sm',
                },
              })}
            </ErrorBoundary>
          </div>
        </Title>
      }
      sortAlphabetically
    />
  );
}

const Title = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
