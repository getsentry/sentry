import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {ContentBlocksRenderer} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/renderer';
import {CopyMarkdownButton} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {stepsToMarkdown} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {SourceMapDiagnosis} from './sourceMapDiagnosis';
import {getTroubleshootingSteps} from './troubleshootingSteps';

interface TroubleshootingSectionProps {
  project: Project;
  sourcemapsDocsUrl: string;
  diagnosis?: SourceMapDiagnosis;
}

export function TroubleshootingSection({
  sourcemapsDocsUrl,
  project,
  diagnosis,
}: TroubleshootingSectionProps) {
  const organization = useOrganization();
  const settingsUrl = `/settings/${organization.slug}/projects/${project.slug}/source-maps/`;
  const steps = getTroubleshootingSteps(settingsUrl, diagnosis);
  const troubleShootingDocUrl =
    project.platform === 'react-native'
      ? `${sourcemapsDocsUrl}troubleshooting/`
      : `${sourcemapsDocsUrl}troubleshooting_js/`;

  return (
    <Stack gap="md" padding="lg">
      <Flex align="center" justify="between">
        <Heading as="h3">{t('Troubleshooting suggestions')}</Heading>
        <CopyMarkdownButton
          getMarkdown={() =>
            `${stepsToMarkdown(steps)}\n\n[${t('Read all documentation')}](${troubleShootingDocUrl})`
          }
          title={t('Copies suggestions as Markdown, optimized for use with an LLM.')}
          label={t('Copy')}
          source="sourcemap_configuration_troubleshooting"
        />
      </Flex>
      {diagnosis && diagnosis.type !== 'unknown' && (
        <Text variant="muted">
          {t('Start with the first suggestion for the sample event.')}
        </Text>
      )}
      <Stack gap="sm">
        {steps.map((step, index) => (
          <Disclosure key={step.title} size="md" defaultExpanded={index === 0}>
            <Disclosure.Title>{step.title}</Disclosure.Title>
            <Disclosure.Content>
              <ContentBlocksRenderer contentBlocks={step.content} />
            </Disclosure.Content>
          </Disclosure>
        ))}
        <Flex paddingTop="sm" align="center" gap="sm">
          <Text variant="muted">{t('Not what you’re looking for?')}</Text>
          <ExternalLink href={troubleShootingDocUrl}>
            <Flex align="center" gap="xs">
              <IconDocs size="xs" />
              {t('Read all documentation')}
            </Flex>
          </ExternalLink>
        </Flex>
      </Stack>
    </Stack>
  );
}
