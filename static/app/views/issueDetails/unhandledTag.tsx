import styled from '@emotion/styled';

import Tag from 'sentry/components/tag';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
