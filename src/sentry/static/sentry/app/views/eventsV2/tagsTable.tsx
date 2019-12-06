import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import * as ReactRouter from 'react-router';

import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {EventTag} from 'app/types';

import {getEventTagSearchUrl} from './utils';
import {SectionHeading} from './styles';

type Props = {
  tags: Array<EventTag>;
} & ReactRouter.WithRouterProps;

const TagsTable = (props: Props) => {
  const {location, tags} = props;
  return (
    <StyledTagsTable>
      <SectionHeading>{t('Event Tag Details')}</SectionHeading>
      <StyledTable>
        <tbody>
          {tags.map(tag => {
            const tagInQuery =
              location.query.query && location.query.query.indexOf(`${tag.key}:`) !== -1;
            return (
              <StyledTr key={tag.key}>
                <TagKey>{tag.key}</TagKey>
                <TagValue>
                  {tagInQuery ? (
                    <Tooltip title={t('This tag is in the current filter conditions')}>
                      <span>{tag.value}</span>
                    </Tooltip>
                  ) : (
                    <Link to={getEventTagSearchUrl(tag.key, tag.value, location)}>
                      {tag.value}
                    </Link>
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

TagsTable.propTypes = {
  tags: PropTypes.array.isRequired,
  location: PropTypes.object,
} as any;

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
    background: #f4f2f7;
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

export default ReactRouter.withRouter(TagsTable);
