import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/views/onboarding/components/scmCardButton';
import {ScmSelectableContainer} from 'sentry/views/onboarding/components/scmSelectableContainer';

interface ScmAlertOptionCardProps {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
  children?: React.ReactNode;
  description?: string;
}

export function ScmAlertOptionCard({
  label,
  description,
  isSelected,
  onSelect,
  children,
}: ScmAlertOptionCardProps) {
  return (
    <ScmSelectableContainer isSelected={isSelected} padding="lg">
      <Stack gap="md">
        <ScmCardButton
          role="radio"
          aria-checked={isSelected}
          onClick={onSelect}
          style={{width: '100%'}}
        >
          <Grid gap="md" align="start" columns="min-content 1fr">
            <Radio size="sm" readOnly checked={isSelected} tabIndex={-1} />
            <Stack gap="xs">
              <Text bold={isSelected} size="md" density="comfortable">
                {label}
              </Text>
              {description && (
                <Text variant="secondary" size="sm" density="comfortable">
                  {description}
                </Text>
              )}
            </Stack>
          </Grid>
        </ScmCardButton>
        {children && <Container paddingLeft="2xl">{children}</Container>}
      </Stack>
    </ScmSelectableContainer>
  );
}
