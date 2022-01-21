import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconGeneric} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  title: string;
  widgetCount: number;
  onPreview: () => void;
  onAdd: () => void;
};

function TemplateCard({title, widgetCount, onPreview, onAdd}: Props) {
  return (
    <StyledCard>
      <Header>
        <IconGeneric size="48" />
        <div>
          {title}
          <Detail>{t('%s Starter Widgets', widgetCount)}</Detail>
        </div>
      </Header>
      <ButtonContainer>
        <StyledButton onClick={onAdd} icon={<IconAdd isCircled />}>
          <TextOverflow>{t('Add Dashboard')}</TextOverflow>
        </StyledButton>
        <StyledButton priority="primary" onClick={onPreview}>
          <TextOverflow>{t('Preview Dashboard')}</TextOverflow>
        </StyledButton>
      </ButtonContainer>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  gap: ${space(1)};
  padding: ${space(2)};
`;

const Detail = styled(TextOverflow)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const Header = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const StyledButton = styled(Button)`
  flex-grow: 1;
`;

export default TemplateCard;
