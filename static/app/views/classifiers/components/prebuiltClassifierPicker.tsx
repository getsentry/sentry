import {Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {ToggleCard} from '@sentry/scraps/toggleCard';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {usePrebuiltClassifiers} from 'sentry/views/classifiers/hooks/usePrebuiltClassifiers';
import type {ClassifierDataset, PrebuiltClassifier} from 'sentry/views/classifiers/types';

interface PrebuiltClassifierPickerProps {
  dataset: ClassifierDataset;
  onSelect: (prebuilt: PrebuiltClassifier) => void;
  selectedKey: string | undefined;
}

export function PrebuiltClassifierPicker({
  dataset,
  onSelect,
  selectedKey,
}: PrebuiltClassifierPickerProps) {
  const {
    data: prebuiltClassifiers,
    isPending,
    isError,
    refetch,
  } = usePrebuiltClassifiers(dataset);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t('Error loading prebuilt classifiers')}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <Grid
      role="radiogroup"
      aria-label={t('Prebuilt classifiers')}
      columns={{xs: '1fr', md: 'repeat(3, minmax(0, 1fr))'}}
      gap="lg"
    >
      {prebuiltClassifiers.map(prebuilt => (
        <ToggleCard
          key={prebuilt.key}
          variant="radio"
          name="prebuilt-classifier"
          padding="lg xl"
          checked={prebuilt.key === selectedKey}
          onChange={() => onSelect(prebuilt)}
        >
          <Stack gap="sm">
            <Text bold size="md">
              {prebuilt.name}
            </Text>
            <Text variant="muted">{prebuilt.description}</Text>
          </Stack>
        </ToggleCard>
      ))}
    </Grid>
  );
}
