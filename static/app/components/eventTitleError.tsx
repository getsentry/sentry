import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

export function EventTitleError() {
  return (
    <Flex as="span" wrap="wrap">
      <Title>{t('<unknown>')}</Title>
      <ErrorMessage>{t('There was an error rendering the title')}</ErrorMessage>
    </Flex>
  );
}

const Title = styled('span')`
  margin-right: ${p => p.theme.space.xs};
`;

const ErrorMessage = styled('span')`
  color: ${p => p.theme.colors.red500};
  background: ${p => p.theme.colors.red100};
  font-size: ${p => p.theme.font.size.md};
  padding: 0 ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  align-items: center;
`;
