import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import TagsTableRow from 'sentry/components/tagsTableRow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, EventTag} from 'sentry/types/event';

type Props = {
  event: Event;
  generateUrl: (tag: EventTag) => LocationDescriptor;
  query: string;
};

export function TagsTable({event, query, generateUrl}: Props) {
  const meta = event._meta?.tags;

  return (
    <StyledTagsTable>
      <SectionHeading>{t('Tag Details')}</SectionHeading>
      {!!meta?.[''] && !event.tags ? (
        <AnnotatedText value={event.tags} meta={meta?.['']} />
      ) : (
        <KeyValueTable>
          {event.tags.map((tag, index) => (
            <TagsTableRow
              key={tag.key}
              tag={tag}
              query={query}
              generateUrl={generateUrl}
              meta={meta?.[index]}
            />
          ))}
        </KeyValueTable>
      )}
    </StyledTagsTable>
  );
}

const StyledTagsTable = styled('div')`
  margin-bottom: ${space(3)};
`;
