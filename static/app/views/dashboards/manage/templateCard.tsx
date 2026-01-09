import {useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import Card from 'sentry/components/card';
import {Button} from 'sentry/components/core/button';
import {IconAdd, IconGeneric} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';

type Props = {
  description: string;
  onAdd: () => Promise<void>;
  onPreview: () => void;
  title: string;
};

function TemplateCard({title, description, onPreview, onAdd}: Props) {
  const [isAddingDashboardTemplate, setIsAddingDashboardTemplate] = useState(false);

  return (
    <StyledCard>
      <Flex gap="xl">
        <IconGeneric legacySize="48px" />
        <Title>
          {title}
          <Detail>{description}</Detail>
        </Title>
      </Flex>
      <Flex wrap="wrap" gap="md">
        <DashboardCreateLimitWrapper>
          {({
            hasReachedDashboardLimit,
            isLoading: isLoadingDashboardsLimit,
            limitMessage,
          }) => (
            <StyledButton
              onClick={() => {
                setIsAddingDashboardTemplate(true);
                onAdd().finally(() => {
                  setIsAddingDashboardTemplate(false);
                });
              }}
              icon={<IconAdd />}
              busy={isAddingDashboardTemplate}
              disabled={hasReachedDashboardLimit || isLoadingDashboardsLimit}
              title={limitMessage}
              tooltipProps={{
                isHoverable: true,
              }}
            >
              {t('Add Dashboard')}
            </StyledButton>
          )}
        </DashboardCreateLimitWrapper>
        <StyledButton priority="primary" onClick={onPreview}>
          {t('Preview')}
        </StyledButton>
      </Flex>
    </StyledCard>
  );
}

const StyledCard = styled(Card)`
  gap: ${space(1)};
  padding: ${space(2)};
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

const StyledButton = styled(Button)`
  flex-grow: 1;
`;

export default TemplateCard;
