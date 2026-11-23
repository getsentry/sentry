import {useId, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import type {AutofixSection} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';

import {CopySectionMarkdown} from './copySectionMarkdown';
import {RetryableAutofixSection} from './retryableAutofixSection';

interface Props {
  children: React.ReactNode;
  section: AutofixSection;
  summary: React.ReactNode;
}

export function getAutofixSectionLabels(step: string) {
  switch (step) {
    case 'root_cause':
      return {
        title: t('Root Cause'),
        prompt: t('How can this root cause be improved?'),
        placeholder: t('Give Seer additional context to improve this root cause.'),
      };
    case 'solution':
      return {
        title: t('Implementation Plan'),
        prompt: t('How can this plan be improved?'),
        placeholder: t('Give Seer additional context to improve this plan.'),
      };
    case 'code_changes':
      return {
        title: t('Code Changes'),
        prompt: t('How can this code change be improved?'),
        placeholder: t('Give Seer additional context to improve these code changes.'),
      };
    default:
      return null;
  }
}

export function IssuePreviewSection({children, section, summary}: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const collapsible = section.step !== 'code_changes';
  const labels = getAutofixSectionLabels(section.step);
  if (!labels) {
    return null;
  }
  const {title, prompt, placeholder} = labels;

  return (
    <Stack as="section" aria-label={title} gap="lg">
      <RetryableAutofixSection.Prompt prompt={prompt} placeholder={placeholder} />
      <Flex align="start" gap="lg">
        <Container flex="1" minWidth={0}>
          {summary}
        </Container>
        <Flex align="center" gap="xs" flexShrink={0}>
          <RetryableAutofixSection.Button />
          <CopySectionMarkdown section={section} />
        </Flex>
      </Flex>
      {children && collapsible && (
        <Flex>
          <Button
            variant="link"
            size="sm"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? t('Show less') : t('Show more')}
          </Button>
        </Flex>
      )}
      {children && (
        <Container id={detailsId} hidden={collapsible && !expanded}>
          {children}
        </Container>
      )}
    </Stack>
  );
}
