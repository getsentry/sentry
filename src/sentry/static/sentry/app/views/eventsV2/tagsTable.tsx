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

type Props = {
  tags: Array<EventTag>;
} & ReactRouter.WithRouterProps;

const TagsTable = (props: Props) => {
  const {location, tags} = props;
  return (
    <div>
      <TagHeading>{t('Event Tag Details')}</TagHeading>
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
    </div>
  );
};
TagsTable.propTypes = {
  tags: PropTypes.array.isRequired,
  location: PropTypes.object,
} as any;

const StyledTable = styled('table')`
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
`;

const TagHeading = styled('h6')`
  color: ${p => p.theme.gray3};
  margin-bottom: 16px;
`;

const StyledTr = styled('tr')`
  &:nth-child(2n) td {
    background: ${p => p.theme.offWhite};
  }
`;

const TagKey = styled('td')`
  color: ${p => p.theme.gray3};
  padding: ${space(0.5)} ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TagValue = styled(TagKey)`
  text-align: right;
  ${overflowEllipsis};
`;

export default ReactRouter.withRouter(TagsTable);
