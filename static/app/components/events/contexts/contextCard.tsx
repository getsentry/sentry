import {Link} from 'react-router';
import styled from '@emotion/styled';

import {
  getContextMeta,
  getContextTitle,
  getFormattedContextData,
} from 'sentry/components/events/contexts/utils';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import Panel from 'sentry/components/panels/panel';
import {StructuredData} from 'sentry/components/structuredEventData';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined, objectIsEmpty} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

interface ContextCardProps {
  alias: string;
  event: Event;
  type: string;
  group?: Group;
  project?: Project;
  value?: Record<string, any>;
}

function ContextCard({alias, event, type, project, value = {}}: ContextCardProps) {
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

  const content = contextItems.map(
    ({key, subject, value: contextValue, action = {}}, i) => {
      if (key === 'type') {
        return null;
      }
      const contextMeta = meta?.[key];
      const contextErrors = contextMeta?.['']?.err ?? [];
      const hasErrors = contextErrors.length > 0;

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

      return (
        <ContextContent key={i} hasErrors={hasErrors}>
          <ContextSubject>{subject}</ContextSubject>
          <ContextValue hasErrors={hasErrors}>
            {defined(action?.link) ? (
              <Link to={action.link}>{dataComponent}</Link>
            ) : (
              dataComponent
            )}
          </ContextValue>
          <ContextErrors>
            <AnnotatedTextErrors errors={contextErrors} />
          </ContextErrors>
        </ContextContent>
      );
    }
  );

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
  grid-template-columns: minmax(100px, auto) 1fr 30px;
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
  grid-column: span 3;
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
  word-wrap: break-word;
`;

const ContextValue = styled(ContextSubject)<{hasErrors: boolean}>`
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.textColor)};
  grid-column: span ${p => (p.hasErrors ? 1 : 2)};
  /* justify-content: space-between;
  display: inline-flex; */
`;

const ContextErrors = styled('div')``;

export default ContextCard;
