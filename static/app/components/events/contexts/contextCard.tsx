import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import type {ContextValue} from 'sentry/components/events/contexts';
import {
  getContextMeta,
  getContextTitle,
  getFormattedContextData,
} from 'sentry/components/events/contexts/utils';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import {StructuredData} from 'sentry/components/structuredEventData';
import {space} from 'sentry/styles/space';
import type {Event, Group, KeyValueListDataItem, Project} from 'sentry/types';
import {defined, objectIsEmpty} from 'sentry/utils';
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
  disableErrors?: boolean;
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
  const {key: contextKey, subject, value: contextValue, action = {}} = item;
  if (contextKey === 'type') {
    return null;
  }
  const contextMeta = meta?.[contextKey];
  const contextErrors = contextMeta?.['']?.err ?? [];
  const hasErrors = contextErrors.length > 0 && !config?.disableErrors;

  const dataComponent = (
    <StructuredData
      value={contextValue}
      depth={0}
      maxDefaultDepth={0}
      meta={contextMeta}
      withAnnotatedText
      withOnlyFormattedText
    />
  );

  const contextSubject =
    config?.includeAliasInSubject && alias ? `${startCase(alias)}: ${subject}` : subject;

  return (
    <ContextContent hasErrors={hasErrors} {...props}>
      <ContextSubject>{contextSubject}</ContextSubject>
      <ContextValueSection hasErrors={hasErrors}>
        <ContextValueWrapper>
          {defined(action?.link) ? (
            <Link to={action.link}>{dataComponent}</Link>
          ) : (
            dataComponent
          )}
        </ContextValueWrapper>
        {hasErrors && (
          <ContextErrors>
            <AnnotatedTextErrors errors={contextErrors} />
          </ContextErrors>
        )}
      </ContextValueSection>
    </ContextContent>
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

  const content = contextItems.map((item, i) => (
    <ContextCardContent key={`context-card-${i}`} meta={meta} item={item} />
  ));

  return (
    <Card>
      <ContextTitle>{getContextTitle({alias, type, value})}</ContextTitle>
      {content}
    </Card>
  );
}

const Card = styled(Panel)`
  padding: ${space(0.75)};
  display: grid;
  column-gap: ${space(1.5)};
  grid-template-columns: minmax(100px, auto) 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const ContextTitle = styled('p')`
  grid-column: span 2;
  padding: ${space(0.25)} ${space(0.75)};
  margin: 0;
  color: ${p => p.theme.headingColor};
  font-weight: bold;
`;

const ContextContent = styled('div')<{hasErrors: boolean}>`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: span 2;
  column-gap: ${space(1.5)};
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 4px;
  color: ${p => (p.hasErrors ? p.theme.alert.error.color : p.theme.subText)};
  border: 1px solid ${p => (p.hasErrors ? p.theme.alert.error.border : 'transparent')};
  background-color: ${p =>
    p.hasErrors ? p.theme.alert.error.backgroundLight : p.theme.background};
  &:nth-child(odd) {
    background-color: ${p =>
      p.hasErrors ? p.theme.alert.error.backgroundLight : p.theme.backgroundSecondary};
  }
`;

const ContextSubject = styled('div')`
  grid-column: span 1;
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-word;
`;

const ContextValueSection = styled(ContextSubject)<{hasErrors: boolean}>`
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.textColor)};
  grid-column: span 1;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-column-gap: ${space(0.5)};
`;

const ContextValueWrapper = styled('div')`
  word-break: break-word;
`;

const ContextErrors = styled('div')``;
