import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function EventTitleError() {
  return (
    <Flex as="span" wrap="wrap">
      <Title>{t('<unknown>')}</Title>
      <ErrorMessage>{t('There was an error rendering the title')}</ErrorMessage>
    </Flex>
  );
}

export default EventTitleError;

const Title = styled('span')`
  margin-right: ${space(0.5)};
`;

const ErrorMessage = styled('span')`
  color: ${p => p.theme.alert.danger.color};
  background: ${p => p.theme.alert.danger.backgroundLight};
  font-size: ${p => p.theme.fontSize.md};
  padding: 0 ${space(0.5)};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  align-items: center;
`;
