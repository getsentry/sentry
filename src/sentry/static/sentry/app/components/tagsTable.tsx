import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import Version from 'app/components/version';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Event, EventTag} from 'app/types/event';

type Props = {
  event: Event;
  query: string;
  generateUrl: (tag: EventTag) => LocationDescriptor;
  title?: React.ReactNode;
};

const TagsTable = ({
  event,
  query,
  generateUrl,
  title = t('Event Tag Details'),
}: Props) => {
  const tags = event.tags;

  return (
    <StyledTagsTable>
      <SectionHeading>{title}</SectionHeading>
      <KeyValueTable>
        {tags.map(tag => {
          const tagInQuery = query.includes(`${tag.key}:`);
          const target = tagInQuery ? undefined : generateUrl(tag);

          const renderTagValue = () => {
            switch (tag.key) {
              case 'release':
                return <Version version={tag.value} anchor={false} withPackage />;
              default:
                return tag.value;
            }
          };

          return (
            <KeyValueTableRow
              key={tag.key}
              keyName={tag.key}
              value={
                tagInQuery ? (
                  <Tooltip title={t('This tag is in the current filter conditions')}>
                    <span>{renderTagValue()}</span>
                  </Tooltip>
                ) : (
                  <Link to={target || ''}>{renderTagValue()}</Link>
                )
              }
            />
          );
        })}
      </KeyValueTable>
    </StyledTagsTable>
  );
};

const StyledTagsTable = styled('div')`
  margin-bottom: ${space(3)};
`;

export default TagsTable;
