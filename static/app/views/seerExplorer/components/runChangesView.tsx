import {useEffect, useRef, useState} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import {IconChevron} from '@sentry/icons/chevron';
import {IconOpen} from '@sentry/icons/open';

import {Alert} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t, tn} from 'sentry/locale';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';
import type {RepoChanges} from 'sentry/views/seerExplorer/runChanges';
import type {ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

/** Files with more changed lines than this start collapsed. */
const MAX_EXPANDED_DIFF_LINES = 300;

type DiffMode = 'all' | 'unpushed';

interface RunChangesViewProps {
  /** The run's changes to every repo, to switch between. */
  allChanges: RepoChanges[];
  changes: RepoChanges;
  onBack: () => void;
  onSelectRepo: (repoName: string) => void;
}

function getTitle({prState, repoName}: RepoChanges) {
  return prState?.pr_number ? `${repoName}#${prState.pr_number}` : repoName;
}

/** The run's changes to one repo, shown in place of the chat until the user goes back. */
export function RunChangesView({
  allChanges,
  changes,
  onBack,
  onSelectRepo,
}: RunChangesViewProps) {
  const {all, allStatus, prState, repoName, unpushed} = changes;
  const [selectedMode, setSelectedMode] = useState<DiffMode>('all');
  // Files the user expanded or collapsed, by path, over each file's default.
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  // Another repo's diff starts over.
  const [shownRepoName, setShownRepoName] = useState(repoName);
  if (shownRepoName !== repoName) {
    setShownRepoName(repoName);
    setSelectedMode('all');
    setExpandedPaths({});
  }
  const backButtonRef = useRef<HTMLButtonElement>(null);

  // The chat behind this view goes inert, so move focus out of it.
  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  const hasPR = !!prState?.pr_number;
  const hasUnpushed = unpushed.files.length > 0;
  // Once Seer pushes the rest, there's nothing left to show as unpushed.
  const mode: DiffMode = hasPR && hasUnpushed ? selectedMode : 'all';
  const shown = mode === 'unpushed' ? unpushed : all;
  const isExpanded = (file: ExplorerFilePatch) =>
    expandedPaths[file.patch.path] ??
    file.patch.added + file.patch.removed <= MAX_EXPANDED_DIFF_LINES;
  const allExpanded = !!shown?.files.every(isExpanded);
  const setAllExpanded = (expanded: boolean) =>
    setExpandedPaths(
      Object.fromEntries((shown?.files ?? []).map(file => [file.patch.path, expanded]))
    );
  // The URL comes from session data, so only link http(s) URLs and never e.g. `javascript:`.
  const prUrl = prState?.pr_url && isValidUrl(prState.pr_url) ? prState.pr_url : null;

  let unpushedTooltip: string;
  if (!hasUnpushed) {
    unpushedTooltip = t('Seer has pushed all of its changes to the PR.');
  } else if (prState?.pr_creation_status === 'creating') {
    unpushedTooltip = t('Seer is pushing these changes to the PR.');
  } else {
    unpushedTooltip = t(
      'Changes Seer made after its last push. They reach the PR the next time Seer pushes to it.'
    );
  }

  return (
    <Stack
      height="100%"
      // Keep focus here when the diff is clicked, so Escape still reaches the handler below.
      tabIndex={-1}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          // Don't let Escape reach the panel and close it.
          event.preventDefault();
          event.stopPropagation();
          onBack();
        }
      }}
    >
      <Flex align="center" gap="md" padding="md xl" borderBottom="primary">
        <Button
          ref={backButtonRef}
          size="xs"
          variant="transparent"
          icon={<IconArrow direction="left" />}
          aria-label={t('Back to chat')}
          onClick={onBack}
        />
        <Stack flex="1" minWidth="0">
          <Flex align="center" gap="xs" minWidth="0">
            {/* `ellipsis` makes the title full width, which would push the link to the end. */}
            <Container minWidth="0">
              {allChanges.length > 1 ? (
                <CompactSelect
                  // The select sizes to its trigger, so cap it to let long titles truncate.
                  style={{maxWidth: '100%'}}
                  size="xs"
                  value={repoName}
                  options={allChanges.map(repoChanges => ({
                    value: repoChanges.repoName,
                    label: getTitle(repoChanges),
                  }))}
                  onChange={option => onSelectRepo(option.value)}
                  // The panel clips overflow and the menu renders inline, so escape the clip.
                  strategy="fixed"
                  position="bottom-start"
                  preventOverflowOptions={{boundary: document.body}}
                  trigger={(triggerProps, isOpen) => (
                    // `link` has no padding, so the title lines up with the PR title below it.
                    <OverlayTrigger.Button
                      {...triggerProps}
                      variant="link"
                      showChevron={false}
                    >
                      <Flex align="center" gap="xs" minWidth="0">
                        {/* The button's own font is smaller than the title's. */}
                        <Text size="md" bold ellipsis>
                          {getTitle(changes)}
                        </Text>
                        <IconChevron
                          size="xs"
                          variant="muted"
                          direction={isOpen ? 'up' : 'down'}
                        />
                      </Flex>
                    </OverlayTrigger.Button>
                  )}
                />
              ) : (
                <Text bold ellipsis>
                  {getTitle(changes)}
                </Text>
              )}
            </Container>
            {prUrl && (
              <LinkButton
                href={prUrl}
                external
                size="zero"
                variant="transparent"
                icon={<IconOpen size="xs" />}
                aria-label={t('Open PR')}
                tooltipProps={{title: t('Open PR')}}
              />
            )}
          </Flex>
          {prState?.title && (
            <Text size="sm" variant="muted" ellipsis>
              {prState.title}
            </Text>
          )}
        </Stack>
        {shown && (
          // Baseline, as the monospace stats sit lower than the file count when centered.
          <Flex align="baseline" gap="sm" flexShrink={0}>
            <Text size="sm" variant="muted">
              {tn('%s file', '%s files', shown.files.length)}
            </Text>
            <Text size="sm" variant="success" monospace>
              +{shown.added}
            </Text>
            <Text size="sm" variant="danger" monospace>
              -{shown.removed}
            </Text>
          </Flex>
        )}
      </Flex>
      <Flex
        align="center"
        justify={hasPR ? 'between' : 'end'}
        gap="md"
        wrap="wrap"
        padding="md xl"
      >
        {hasPR && (
          <SegmentedControl
            size="xs"
            aria-label={t('Changes to show')}
            value={mode}
            onChange={setSelectedMode}
          >
            <SegmentedControl.Item
              key="all"
              tooltip={t("The PR's changes, with Seer's unpushed changes on top.")}
            >
              {t('All changes')}
            </SegmentedControl.Item>
            <SegmentedControl.Item
              key="unpushed"
              disabled={!hasUnpushed}
              tooltip={unpushedTooltip}
            >
              {t('Unpushed')}
            </SegmentedControl.Item>
          </SegmentedControl>
        )}
        {shown && shown.files.length > 0 && (
          <Button
            size="xs"
            icon={<IconChevron direction={allExpanded ? 'up' : 'down'} />}
            onClick={() => setAllExpanded(!allExpanded)}
          >
            {allExpanded ? t('Collapse all') : t('Expand all')}
          </Button>
        )}
      </Flex>
      {/* Keyed so another repo's diff also starts over at the top. */}
      <Container key={repoName} flex="1" minHeight="0" overflowY="auto" padding="0 xl xl">
        <Stack gap="md">
          {!shown && allStatus === 'pending' && (
            <Stack gap="md">
              <Placeholder height="2.5rem" />
              <Placeholder height="10rem" />
            </Stack>
          )}
          {!shown && allStatus === 'error' && (
            <Alert variant="danger">{t("Couldn't load the PR's changes.")}</Alert>
          )}
          {shown?.files.map((file, index) => (
            <FileDiffViewer
              key={`${mode}-${file.patch.path}-${index}`}
              patch={file.patch}
              fileUrl={file.code_url}
              showBorder
              collapsible
              expanded={isExpanded(file)}
              onExpandedChange={expanded =>
                setExpandedPaths(paths => ({...paths, [file.patch.path]: expanded}))
              }
            />
          ))}
        </Stack>
      </Container>
    </Stack>
  );
}
