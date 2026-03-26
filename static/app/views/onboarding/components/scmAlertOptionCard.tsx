import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {ScmCardButton} from 'sentry/views/onboarding/components/scmCardButton';

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
    <ScmCardButton aria-checked={isSelected} onClick={onSelect}>
      <Stack gap="lg">
        <Container
          border={isSelected ? 'accent' : 'secondary'}
          padding="lg"
          radius="md"
          style={isSelected ? {marginBottom: 1} : {borderBottomWidth: 2}}
        >
          <Grid gap="md" align="center" columns="min-content 1fr min-content">
            <Radio size="sm" readOnly checked={isSelected} tabIndex={-1} />
            <Text bold={isSelected} size="md" density="comfortable">
              {label}
            </Text>
            <Flex align="center">{icon}</Flex>
          </Grid>
        </Container>
        {children}
      </Stack>
    </ScmCardButton>
  );
}
