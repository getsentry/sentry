import {IconPlay} from '@sentry/icons/play';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ClassifierDataset, PrebuiltClassifier} from 'sentry/views/classifiers/types';
import {getClassifiersPath} from 'sentry/views/classifiers/utils';

import {ClassifierProjectSelect} from './classifierProjectSelect';
import {PrebuiltClassifierPicker} from './prebuiltClassifierPicker';
import {WizardBody, WizardFooter, WizardStep} from './wizardLayout';

export interface ClassifierFiltersStepProps {
  dataset: ClassifierDataset;
  filters: React.ReactNode;
  isPreviewing: boolean;
  onNext: () => void;
  onPreview: () => void;
  onSelectPrebuilt: (prebuilt: PrebuiltClassifier) => void;
  prebuilt: PrebuiltClassifier | null;
  preview: React.ReactNode;
  resetParamsOnProjectChange?: string[];
}

export function ClassifierFiltersStep({
  dataset,
  filters,
  isPreviewing,
  onNext,
  onPreview,
  onSelectPrebuilt,
  prebuilt,
  preview,
  resetParamsOnProjectChange,
}: ClassifierFiltersStepProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const hasProject = selection.projects.length === 1;

  return (
    <WizardStep>
      <WizardBody maxWidth="1088px">
        <Container border="primary" radius="md" padding="xl">
          <Stack gap="xl">
            <Stack gap="md">
              <Heading as="h2" size="md">
                {t('Filter classifier')}
              </Heading>
              <Flex gap="md" align="center" wrap="wrap">
                <ClassifierProjectSelect resetParams={resetParamsOnProjectChange} />
                <EnvironmentPageFilter />
                {filters}
              </Flex>
            </Stack>
            <Stack gap="md">
              <Heading as="h2" size="md">
                {t('Prebuilt classifiers')}
              </Heading>
              <PrebuiltClassifierPicker
                dataset={dataset}
                selectedKey={prebuilt?.key}
                onSelect={onSelectPrebuilt}
              />
            </Stack>
            <Flex justify="end">
              <Button icon={<IconPlay />} disabled={!hasProject} onClick={onPreview}>
                {isPreviewing ? t('Re-run preview') : t('Preview')}
              </Button>
            </Flex>
          </Stack>
        </Container>
        {isPreviewing && preview}
      </WizardBody>
      <WizardFooter step={1}>
        <LinkButton to={getClassifiersPath(organization.slug)}>{t('Back')}</LinkButton>
        <Button
          variant="primary"
          disabled={!hasProject || !prebuilt}
          tooltipProps={{
            title: prebuilt ? undefined : t('Select a prebuilt classifier to continue'),
          }}
          onClick={onNext}
        >
          {t('Next')}
        </Button>
      </WizardFooter>
    </WizardStep>
  );
}
