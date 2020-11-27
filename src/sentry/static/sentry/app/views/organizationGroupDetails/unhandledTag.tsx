import React from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';

// TODO(matej): remove "unhandled-issue-flag" feature flag once testing is over (otherwise this won't ever be rendered in a shared event)
function UnhandledTag() {
  return (
    <Feature features={['unhandled-issue-flag']}>
      <TagWrapper>
        <Tooltip title={t('An unhandled error was detected in this Issue.')}>
          <Tag type="error">{t('Unhandled')}</Tag>
        </Tooltip>
      </TagWrapper>
    </Feature>
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
