import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';

function UnhandledTag() {
  return (
    <TagWrapper>
      <Tooltip title={t('An unhandled error was detected in this Issue.')}>
        <Tag type="error">{t('Unhandled')}</Tag>
      </Tooltip>
    </TagWrapper>
  );
}

const TagWrapper = styled('div')`
  margin-right: ${space(1)};
`;

const TagAndMessageWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

export default UnhandledTag;
export {TagAndMessageWrapper};
