import * as React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Card from 'sentry/components/card';
import {IconAdd, IconGeneric} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
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
        <CardText>
          <Title>{title}</Title>
          <Detail>{t('%s Starter Widgets', widgetCount)}</Detail>
        </CardText>
      </Header>
      <ButtonContainer>
        <StyledButton
          priority="default"
          onClick={onAdd}
          icon={<IconAdd size="xs" isCircled />}
          label={t('Add Dashboard')}
        >
          {t('Add Dashboard')}
        </StyledButton>
        <StyledButton priority="primary" onClick={onPreview} label={t('Preview')}>
          {t('Preview')}
        </StyledButton>
      </ButtonContainer>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  padding: ${space(2)};
  display: inline;
`;

const Title = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

const Detail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  ${overflowEllipsis};
  line-height: 1.5;
`;

const Header = styled('div')`
  display: flex;
  padding-bottom: ${space(2)};
`;

const CardText = styled('div')`
  padding-left: ${space(2)};
`;

const ButtonContainer = styled('div')`
  display: flex;
`;

const StyledButton = styled(Button)<{priority: string}>`
  display: block;
  width: auto;
  ${overflowEllipsis};

  ${p =>
    p.priority === 'default' &&
    `width: 100%;
    margin-right: ${space(2)};`};
`;

export default TemplateCard;
