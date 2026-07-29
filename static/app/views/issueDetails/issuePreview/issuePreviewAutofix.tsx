import {useMemo} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {
  getOrderedAutofixSections,
  useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixStartCard} from 'sentry/components/events/autofix/v3/autofixStartCard';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {
  useHandleCopyMarkdown,
  useHandleRestart,
} from 'sentry/components/events/autofix/v3/drawer';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCopy} from 'sentry/icons/iconCopy';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useAiConfig} from 'sentry/views/issueDetails/hooks/useAiConfig';

interface IssuePreviewAutofixProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  project: Project;
}

export function IssuePreviewAutofix({autofix, group, project}: IssuePreviewAutofixProps) {
  const aiConfig = useAiConfig(group, project);

  const handleCopyMarkdown = useHandleCopyMarkdown({aiAutofix: autofix});
  const handleRestart = useHandleRestart({aiAutofix: autofix});

  const sections = useMemo(
    () => getOrderedAutofixSections(autofix.runState),
    [autofix.runState]
  );

  if (aiConfig.isAutofixSetupLoading) {
    return (
      <Stack gap="xl">
        <Placeholder height="10rem" />
        <Placeholder height="15rem" />
      </Stack>
    );
  }

  // autofix results are loading, or we're polling and no blocks have been added yet
  if (autofix.isLoading || (autofix.isPolling && !autofix.runState?.blocks?.length)) {
    return <Placeholder height="15rem" />;
  }

  // No run yet — show the start-analysis card; it kicks off a run that renders in place.
  if (!sections.length) {
    return <AutofixStartCard autofix={autofix} group={group} />;
  }

  return (
    <Stack gap="lg">
      <Flex justify="end" gap="xs">
        <Button
          size="xs"
          variant="transparent"
          icon={<IconRefresh />}
          onClick={handleRestart}
          disabled={!handleRestart}
          tooltipProps={{title: t('Start a new analysis from scratch')}}
          aria-label={t('Start a new analysis from scratch')}
        />
        <Button
          size="xs"
          variant="transparent"
          icon={<IconCopy />}
          onClick={handleCopyMarkdown}
          disabled={!handleCopyMarkdown}
          tooltipProps={{title: t('Copy analysis as Markdown')}}
          aria-label={t('Copy analysis as Markdown')}
        />
      </Flex>
      <SeerDrawerContent group={group} autofix={autofix} aiConfig={aiConfig} />
    </Stack>
  );
}
