import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconFatal} from 'sentry/icons';
import {t} from 'sentry/locale';

function UnhandledTag() {
  return (
    <Tooltip skipWrapper title={t('An unhandled error was detected in this Issue.')}>
      <UnhandledTagWrapper>
        <StyledIconFatal size="xs" color="errorText" />
        {t('Unhandled')}
      </UnhandledTagWrapper>
    </Tooltip>
  );
}

export default UnhandledTag;

const UnhandledTagWrapper = styled('div')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  color: ${p => p.theme.errorText};
`;

const StyledIconFatal = styled(IconFatal)`
  margin-top: -2px;
  margin-right: 3px;
`;
