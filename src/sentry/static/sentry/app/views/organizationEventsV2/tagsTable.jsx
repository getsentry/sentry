import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import {withRouter} from 'react-router';

import Link from 'app/components/links/link';
import {t} from 'app/locale';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {getEventTagSearchUrl} from './utils';

const TagsTable = props => {
  return (
    <div>
      <TagHeading>{t('Tags')}</TagHeading>
      <StyledTable>
        <tbody>
          {props.tags.map(tag => (
            <StyledTr key={tag.key}>
              <TagKey>{tag.key}</TagKey>
              <TagValue>
                <Link to={getEventTagSearchUrl(tag.key, tag.value, props.location)}>
                  {tag.value}
                </Link>
              </TagValue>
            </StyledTr>
          ))}
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

export default withRouter(TagsTable);
