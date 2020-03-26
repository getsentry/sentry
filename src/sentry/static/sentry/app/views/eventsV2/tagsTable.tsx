import React from 'react';
import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';

import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Event, OrganizationSummary} from 'app/types';
import Version from 'app/components/version';
import EventView from 'app/utils/discover/eventView';

import {getExpandedResults} from './utils';
import {SectionHeading} from './styles';

type Props = {
  organization: OrganizationSummary;
  event: Event;
  eventView: EventView;
};

const TagsTable = (props: Props) => {
  const {organization, event, eventView} = props;
  const tags = event.tags;
  return (
    <StyledTagsTable>
      <SectionHeading>{t('Event Tag Details')}</SectionHeading>
      <StyledTable>
        <tbody>
          {tags.map(tag => {
            let target: LocationDescriptor | undefined;
            const tagInQuery = eventView.query.includes(`${tag.key}:`);
            const renderTagValue = () => {
              switch (tag.key) {
                case 'release':
                  return <Version version={tag.value} anchor={false} withPackage />;
                default:
                  return tag.value;
              }
            };
            if (!tagInQuery) {
              const nextView = getExpandedResults(
                eventView,
                {[tag.key]: tag.value},
                event
              );
              target = nextView.getResultsViewUrlTarget(organization.slug);
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
                    <Link to={target}>{renderTagValue()}</Link>
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
    background-color: ${p => p.theme.offWhite};
  }
`;

const TagKey = styled('td')`
  color: ${p => p.theme.gray3};
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
