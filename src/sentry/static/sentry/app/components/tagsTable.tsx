import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Event, EventTag} from 'app/types';
import Version from 'app/components/version';

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
      <StyledTable>
        <tbody>
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
              <StyledTr key={tag.key}>
                <TagKey>{tag.key}</TagKey>
                <TagValue>
                  {tagInQuery ? (
                    <Tooltip title={t('This tag is in the current filter conditions')}>
                      <span>{renderTagValue()}</span>
                    </Tooltip>
                  ) : (
                    <Link to={target || ''}>{renderTagValue()}</Link>
                  )}
                </TagValue>
              </StyledTr>
            );
          })}
        </tbody>
      </StyledTable>
    </StyledTagsTable>
  );
};

const StyledTagsTable = styled('div')`
  margin-bottom: ${space(3)};
`;

const StyledTable = styled('table')`
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
`;

const StyledTr = styled('tr')`
  &:nth-child(2n + 1) td {
    background-color: ${p => p.theme.gray100};
  }
`;

const TagKey = styled('td')`
  color: ${p => p.theme.gray600};
  padding: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TagValue = styled(TagKey)`
  text-align: right;
  ${overflowEllipsis};
`;

export default TagsTable;
