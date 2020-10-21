import * as React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import Tag from 'app/components/tagDeprecated';
import Feature from 'app/components/acl/feature';
import Tooltip from 'app/components/tooltip';
import {IconSubtract} from 'app/icons';

const TagWrapper = styled('div')`
  margin-right: ${space(1)};
`;

const TagAndMessageWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

// TODO(matej): remove "unhandled-issue-flag" feature flag once testing is over (otherwise this won't ever be rendered in a shared event)
const UnhandledTag = styled((props: React.ComponentProps<typeof Tag>) => (
  <Feature features={['unhandled-issue-flag']}>
    <TagWrapper>
      <Tooltip title={t('An unhandled error was detected in this Issue.')}>
        <Tag
          priority="error"
          icon={<IconSubtract size="xs" color="red300" isCircled />}
          {...props}
        >
          {t('Unhandled')}
        </Tag>
      </Tooltip>
    </TagWrapper>
  </Feature>
))`
  /* TODO(matej): There is going to be a major Tag component refactor which should make Tags look something like this - then we can remove these one-off styles */
  background-color: #ffecf0;
  color: ${p => p.theme.gray700};
  text-transform: none;
  padding: 0 ${space(0.75)};
  height: 17px;

  & > span {
    margin-right: 0 ${space(0.5)};
  }

  & > span,
  & svg {
    height: 10px;
    width: 10px;
  }
`;

export default UnhandledTag;
export {TagAndMessageWrapper};
