import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor, Location} from 'history';

import {SectionHeading} from 'app/components/charts/styles';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Event, OrganizationSummary} from 'app/types';
import Version from 'app/components/version';
import {decodeScalar, appendTagCondition} from 'app/utils/queryString';

import {transactionSummaryRouteWithQuery} from '../transactionSummary/utils';

type Props = {
  organization: OrganizationSummary;
  event: Event;
  location: Location;
  projectId: string;
};

const TagsTable = (props: Props) => {
  const {organization, event, location, projectId} = props;

  const tags = event.tags;
  const query = decodeScalar(location.query.query) || '';

  return (
    <StyledTagsTable>
      <SectionHeading>{t('Event Tag Details')}</SectionHeading>
      <StyledTable>
        <tbody>
          {tags.map(tag => {
            let target: LocationDescriptor | undefined;
            const tagInQuery = query.includes(`${tag.key}:`);
            const renderTagValue = () => {
              switch (tag.key) {
                case 'release':
                  return <Version version={tag.value} anchor={false} withPackage />;
                default:
                  return tag.value;
              }
            };
            if (!tagInQuery) {
              const newQuery = {
                ...location.query,
                query: appendTagCondition(query, tag.key, tag.value),
              };
              target = transactionSummaryRouteWithQuery({
                orgSlug: organization.slug,
                transaction: event.title,
                projectID: projectId,
                query: newQuery,
              });
            }

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
