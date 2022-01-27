import styled from '@emotion/styled';

import Tooltip from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';

const UnhandledTag = () => (
  <Tooltip title={t('An unhandled error was detected in this Issue.')}>
    <UnhandledTagWrapper>
      <StyledIconFire size="xs" color="red300" />
      {t('Unhandled')}
    </UnhandledTagWrapper>
  </Tooltip>
);

export default UnhandledTag;

const UnhandledTagWrapper = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  color: ${p => p.theme.red300};
`;

const StyledIconFire = styled(IconFire)`
  margin-right: 3px;
`;
