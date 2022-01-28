import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import {IconAdd, IconGeneric} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  title: string;
  description: string;
  onPreview: () => void;
  onAdd: () => void;
};

function TemplateCard({title, description, onPreview, onAdd}: Props) {
  return (
    <StyledCard>
      <Header>
        <IconGeneric size="48" />
        <Title>
          {title}
          <Detail>{description}</Detail>
        </Title>
      </Header>
      <ButtonContainer>
        <StyledButton onClick={onAdd} icon={<IconAdd isCircled />}>
          {t('Add Dashboard')}
        </StyledButton>
        <StyledButton priority="primary" onClick={onPreview}>
          {t('Preview')}
        </StyledButton>
      </ButtonContainer>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  gap: ${space(1)};
  padding: ${space(2)};
`;

const Header = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const Title = styled('div')`
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`;

const Detail = styled(Title)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const ButtonContainer = styled('div')`
  display: flex;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    flex-direction: column;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    flex-direction: row;
  }
`;

const StyledButton = styled(Button)`
  flex-grow: 1;
`;

export default TemplateCard;
