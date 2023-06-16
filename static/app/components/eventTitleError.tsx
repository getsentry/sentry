import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

function EventTitleError() {
  return (
    <Wrapper>
      <Title>{t('<unknown>')}</Title>
      <ErrorMessage>{t('There was an error rendering the title')}</ErrorMessage>
    </Wrapper>
  );
}

export default EventTitleError;

const Wrapper = styled('span')`
  display: flex;
  flex-wrap: wrap;
`;

const Title = styled('span')`
  margin-right: ${space(0.5)};
`;

const ErrorMessage = styled('span')`
  color: ${p => p.theme.alert.error.iconColor};
  background: ${p => p.theme.alert.error.backgroundLight};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0 ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
`;
