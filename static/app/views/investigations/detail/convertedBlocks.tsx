import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {isFilePatch, type FilePatch} from 'sentry/components/events/autofix/types';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  InvestigationBlock,
  InvestigationBlockKind,
} from 'sentry/views/investigations/types';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

const rootCauseSchema = z.object({
  five_whys: z.array(z.string()),
  fixability: z.object({assessment: z.string(), reason: z.string()}).nullish(),
  headline: z.string(),
  one_line_description: z.string(),
  relevant_repo: z.string().nullish(),
  reproduction_steps: z.array(z.string()).default([]),
});

const solutionSchema = z.object({
  one_line_summary: z.string(),
  steps: z.array(z.object({description: z.string(), title: z.string()})),
});

const codeChangesSchema = z.object({
  patches: z.array(
    z.object({
      code_url: z.string().nullish(),
      patch: z.custom<FilePatch>(isFilePatch),
      repo_name: z.string(),
    })
  ),
  repo_name: z.string(),
});

const pullRequestSchema = z.object({
  pr_number: z.number().nullable(),
  pr_url: z.string().nullable(),
  repo_name: z.string(),
  seer_run_id: z.number(),
});

const triageVerdictsSchema = z.object({
  rows: z.array(
    z.object({
      autofix_seer_run_id: z.number().nullable(),
      group_id: z.number().nullable(),
      short_id: z.string().nullable(),
      title: z.string().nullable(),
      verdict: z.object({
        action: z.string(),
        reason: z.string().optional(),
        skip_reason: z.string().nullish(),
      }),
    })
  ),
});

const CONVERTED_BLOCK_KINDS: ReadonlySet<InvestigationBlockKind> = new Set([
  'root_cause',
  'solution',
  'code_changes',
  'pull_request',
  'triage_verdicts',
]);

export function isConvertedBlockKind(kind: InvestigationBlockKind) {
  return CONVERTED_BLOCK_KINDS.has(kind);
}

export function hasConvertedBlockContent(block: InvestigationBlock) {
  return renderConvertedBlock(block) !== null;
}

export function ConvertedBlockContent({block}: {block: InvestigationBlock}) {
  return renderConvertedBlock(block);
}

function renderConvertedBlock(block: InvestigationBlock) {
  switch (block.kind) {
    case 'root_cause': {
      const parsed = rootCauseSchema.safeParse(block.config);
      return parsed.success ? <RootCause rootCause={parsed.data} /> : null;
    }
    case 'solution': {
      const parsed = solutionSchema.safeParse(block.config);
      return parsed.success ? <Solution solution={parsed.data} /> : null;
    }
    case 'code_changes': {
      const parsed = codeChangesSchema.safeParse(block.config);
      return parsed.success ? <CodeChanges changes={parsed.data} /> : null;
    }
    case 'pull_request': {
      const parsed = pullRequestSchema.safeParse(block.config);
      return parsed.success ? <PullRequest pullRequest={parsed.data} /> : null;
    }
    case 'triage_verdicts': {
      const parsed = triageVerdictsSchema.safeParse(block.config);
      return parsed.success ? <TriageVerdicts rows={parsed.data.rows} /> : null;
    }
    default:
      return null;
  }
}

function numbered(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function RootCause({rootCause}: {rootCause: z.infer<typeof rootCauseSchema>}) {
  const fixability = rootCause.fixability;
  return (
    <Stack minWidth={0} gap="lg">
      <Stack gap="sm">
        <Heading as="h3" size="lg">
          {t('Root cause')}
        </Heading>
        <SeerMarkdown raw={rootCause.one_line_description} />
      </Stack>
      <Flex gap="sm" wrap="wrap" align="center">
        {fixability ? (
          <Tag variant={fixability.assessment === 'fixable' ? 'success' : 'warning'}>
            {fixability.assessment === 'fixable'
              ? t('Fixable')
              : fixability.assessment === 'needs_more_context'
                ? t('Needs more context')
                : t('Not actionable')}
          </Tag>
        ) : null}
        {rootCause.relevant_repo ? (
          <Tag variant="muted">{rootCause.relevant_repo}</Tag>
        ) : null}
      </Flex>
      {fixability ? (
        <Stack gap="xs">
          <Text bold>{t('Fixability')}</Text>
          <SeerMarkdown raw={fixability.reason} />
        </Stack>
      ) : null}
      {rootCause.five_whys.length > 0 ? (
        <Stack gap="xs">
          <Text bold>{t('Why it happened')}</Text>
          <SeerMarkdown raw={numbered(rootCause.five_whys)} />
        </Stack>
      ) : null}
      {rootCause.reproduction_steps.length > 0 ? (
        <Stack gap="xs">
          <Text bold>{t('Reproduction steps')}</Text>
          <SeerMarkdown raw={numbered(rootCause.reproduction_steps)} />
        </Stack>
      ) : null}
    </Stack>
  );
}

function Solution({solution}: {solution: z.infer<typeof solutionSchema>}) {
  return (
    <Stack minWidth={0} gap="lg">
      <Stack gap="sm">
        <Heading as="h3" size="lg">
          {t('Plan')}
        </Heading>
        <SeerMarkdown raw={solution.one_line_summary} />
      </Stack>
      {solution.steps.map((step, index) => (
        <Stack key={index} gap="xs">
          <Text bold>{`${index + 1}. ${step.title}`}</Text>
          <SeerMarkdown raw={step.description} />
        </Stack>
      ))}
    </Stack>
  );
}

function CodeChanges({changes}: {changes: z.infer<typeof codeChangesSchema>}) {
  return (
    <Stack minWidth={0} gap="lg">
      <Flex gap="sm" align="center" wrap="wrap">
        <Heading as="h3" size="lg">
          {t('Code changes')}
        </Heading>
        <Tag variant="muted">{changes.repo_name}</Tag>
      </Flex>
      <Stack gap="md">
        {changes.patches.map(patch => (
          <FileDiffViewer
            key={patch.patch.path}
            patch={patch.patch}
            repoName={patch.repo_name}
            fileUrl={patch.code_url}
            collapsible
            showBorder
          />
        ))}
      </Stack>
    </Stack>
  );
}

function PullRequest({pullRequest}: {pullRequest: z.infer<typeof pullRequestSchema>}) {
  return (
    <Stack minWidth={0} gap="sm">
      <Heading as="h3" size="lg">
        {t('Pull request')}
      </Heading>
      {pullRequest.pr_url ? (
        <ExternalLink href={pullRequest.pr_url}>
          {pullRequest.pr_number
            ? t('%s #%s', pullRequest.repo_name, pullRequest.pr_number)
            : pullRequest.pr_url}
        </ExternalLink>
      ) : (
        <Text variant="muted">{pullRequest.repo_name}</Text>
      )}
    </Stack>
  );
}

function verdictLabel(
  verdict: z.infer<typeof triageVerdictsSchema>['rows'][number]['verdict']
) {
  if (verdict.action === 'autofix') {
    return t('Fix');
  }
  if (verdict.action === 'root_cause_only') {
    return t('Root cause only');
  }
  if (verdict.action === 'skip') {
    return verdict.skip_reason
      ? t('Skip: %s', verdict.skip_reason.replaceAll('_', ' '))
      : t('Skip');
  }
  return verdict.action;
}

function TriageVerdicts({rows}: {rows: z.infer<typeof triageVerdictsSchema>['rows']}) {
  const organization = useOrganization();
  return (
    <Stack minWidth={0} gap="lg">
      <Heading as="h3" size="lg">
        {t('Verdicts')}
      </Heading>
      <SimpleTable
        columns={[
          {key: 'issue', width: 'minmax(0, 2fr)'},
          {key: 'verdict', width: 'max-content'},
          {key: 'reason', width: 'minmax(0, 3fr)'},
        ]}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Verdict')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Reason')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {rows.map((row, index) => (
          <SimpleTable.Row key={row.group_id ?? `row-${index}`}>
            <SimpleTable.RowCell>
              {row.group_id === null ? (
                <Text variant="muted">{t('Unknown issue')}</Text>
              ) : (
                <Stack gap="2xs" minWidth={0}>
                  <Link
                    to={`/organizations/${organization.slug}/issues/${row.group_id}/`}
                  >
                    {row.short_id ?? row.group_id}
                  </Link>
                  {row.title ? (
                    <Text size="sm" variant="muted" ellipsis>
                      {row.title}
                    </Text>
                  ) : null}
                </Stack>
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Tag
                variant={
                  row.verdict.action === 'autofix'
                    ? 'success'
                    : row.verdict.action === 'skip'
                      ? 'muted'
                      : 'info'
                }
              >
                {verdictLabel(row.verdict)}
              </Tag>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text size="sm" wordBreak="break-word">
                {row.verdict.reason ?? ''}
              </Text>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))}
      </SimpleTable>
    </Stack>
  );
}
