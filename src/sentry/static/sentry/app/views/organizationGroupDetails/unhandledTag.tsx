import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Tag from 'app/components/tag';
import Feature from 'app/components/acl/feature';
import Tooltip from 'app/components/tooltip';

const TagWrapper = styled('div')`
  margin-right: ${space(1)};
`;

const TagAndMessageWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

// TODO(matej): remove "unhandled-issue-flag" feature flag once testing is over (otherwise this won't ever be rendered in a shared event)
const UnhandledTag = styled(props => (
  <Feature features={['unhandled-issue-flag']}>
    <TagWrapper>
      <Tooltip title={t('An unhandled error was detected in this Issue.')}>
        <Tag priority="error" {...props}>
          {t('Unhandled')}
        </Tag>
      </Tooltip>
    </TagWrapper>
  </Feature>
))`
  background-color: ${p => p.theme.red300};
  text-transform: none;
`;

export default UnhandledTag;
export {TagAndMessageWrapper};
