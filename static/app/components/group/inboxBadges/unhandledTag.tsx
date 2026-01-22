import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconFatal} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

function UnhandledTag() {
  const hasStreamlinedUI = useHasStreamlinedUI();
  return (
    <Flex align="center">
      {props => (
        <Text wrap="nowrap" variant="danger" {...props}>
          {!hasStreamlinedUI && <StyledIconFatal size="xs" variant="danger" />}
          {t('Unhandled')}
        </Text>
      )}
    </Flex>
  );
}

export default UnhandledTag;

const StyledIconFatal = styled(IconFatal)`
  margin-top: -2px;
  margin-right: 3px;
`;
