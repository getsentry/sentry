import {useState} from 'react';
import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {Button} from 'sentry/components/core/button';
import {IconAdd, IconGeneric} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDashboardsLimit} from 'sentry/views/dashboards/hooks/useDashboardsLimit';

type Props = {
  description: string;
  onAdd: () => Promise<void>;
  onPreview: () => void;
  title: string;
};

function TemplateCard({title, description, onPreview, onAdd}: Props) {
  const [isAddingDashboardTemplate, setIsAddingDashboardTemplate] = useState(false);
  const {
    hasReachedDashboardLimit,
    isLoading: isLoadingDashboardsLimit,
    limitMessage,
  } = useDashboardsLimit();

  return (
    <StyledCard>
      <Header>
        <IconGeneric legacySize="48px" />
        <Title>
          {title}
          <Detail>{description}</Detail>
        </Title>
      </Header>
      <ButtonContainer>
        <StyledButton
          onClick={() => {
            setIsAddingDashboardTemplate(true);
            onAdd().finally(() => {
              setIsAddingDashboardTemplate(false);
            });
          }}
          icon={<IconAdd isCircled />}
          busy={isAddingDashboardTemplate}
          disabled={hasReachedDashboardLimit || isLoadingDashboardsLimit}
          title={limitMessage}
        >
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
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const ButtonContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const StyledButton = styled(Button)`
  flex-grow: 1;
`;

export default TemplateCard;
