import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {SectionHeading} from 'sentry/components/charts/styles';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {KeyValueTable} from 'sentry/components/keyValueTable';
import TagsTableRow from 'sentry/components/tagsTableRow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, EventTag} from 'sentry/types/event';

type Props = {
  event: Event;
  generateUrl: (tag: EventTag) => LocationDescriptor;
  query: string;
  title?: React.ReactNode;
};

const TagsTable = ({event, query, generateUrl, title = t('Tag Details')}: Props) => {
  const eventWithMeta = withMeta(event) as Event;
  const tags = eventWithMeta.tags;

  return (
    <StyledTagsTable>
      <SectionHeading>{title}</SectionHeading>
      <KeyValueTable>
        {tags.map(tag => (
          <TagsTableRow key={tag.key} tag={tag} query={query} generateUrl={generateUrl} />
        ))}
      </KeyValueTable>
    </StyledTagsTable>
  );
};

export default TagsTable;

const StyledTagsTable = styled('div')`
  margin-bottom: ${space(3)};
`;
