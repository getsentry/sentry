import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';

import {ReactRouterLocation} from 'app/types/reactRouter';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {EventTag} from 'app/types';

import {getEventTagSearchUrl} from './utils';

type Props = {
  location: ReactRouterLocation;
  tags: Array<EventTag>;
};

const TagsTable = (props: Props) => {
  const {location, tags} = props;
  return (
    <div>
      <TagHeading>{t('Tags')}</TagHeading>
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
};

const StyledTable = styled('table')`
  table-layout: fixed;
  width: 100%;
  max-width: 100%;
`;

const TagHeading = styled('h5')`
  text-transform: uppercase;
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0 0 ${space(1)} ${space(1)};
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

// TODO(ts): ReactRouterLocation type
// @ts-ignore
export default withRouter(TagsTable);
