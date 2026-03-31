import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/views/onboarding/components/scmCardButton';
import {ScmSelectableContainer} from 'sentry/views/onboarding/components/scmSelectableContainer';

interface ScmAlertOptionCardProps {
  icon: React.ReactNode;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  children?: React.ReactNode;
}

export function ScmAlertOptionCard({
  label,
  icon,
  isSelected,
  onSelect,
  children,
}: ScmAlertOptionCardProps) {
  return (
    <Stack gap="lg">
      <ScmCardButton role="radio" aria-checked={isSelected} onClick={onSelect}>
        <ScmSelectableContainer isSelected={isSelected} padding="lg">
          <Grid gap="md" align="center" columns="min-content 1fr min-content">
            <Radio size="sm" readOnly checked={isSelected} tabIndex={-1} />
            <Text bold={isSelected} size="md" density="comfortable">
              {label}
            </Text>
            <Flex align="center">{icon}</Flex>
          </Grid>
        </ScmSelectableContainer>
      </ScmCardButton>
      {children}
    </Stack>
  );
}
