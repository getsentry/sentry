import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';
import {t} from 'app/locale';
import space from 'app/styles/space';

const TagsTable = props => {
  return (
    <div>
      <TagHeading>{t('Tags')}</TagHeading>
      <table>
        <tbody>
          {props.tags.map(tag => (
            <StyledTr key={tag.key}>
              <TagKey>{tag.key}</TagKey>
              <TagValue>{tag.value}</TagValue>
            </StyledTr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
TagsTable.propTypes = {
  tags: PropTypes.array.isRequired,
};

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
`;

export default TagsTable;
