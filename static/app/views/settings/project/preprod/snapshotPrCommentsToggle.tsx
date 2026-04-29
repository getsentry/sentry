import {Fragment} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const ENABLED_READ_KEY = 'sentry:preprod_snapshot_pr_comments_enabled';
const ENABLED_WRITE_KEY = 'preprodSnapshotPrCommentsEnabled';
const ONLY_IF_DIFF_READ_KEY = 'sentry:preprod_snapshot_pr_comments_only_if_diff';
const ONLY_IF_DIFF_WRITE_KEY = 'preprodSnapshotPrCommentsOnlyIfDiff';
const POST_ON_ADDED_READ_KEY = 'sentry:preprod_snapshot_pr_comments_post_on_added';
const POST_ON_ADDED_WRITE_KEY = 'preprodSnapshotPrCommentsPostOnAdded';
const POST_ON_REMOVED_READ_KEY = 'sentry:preprod_snapshot_pr_comments_post_on_removed';
const POST_ON_REMOVED_WRITE_KEY = 'preprodSnapshotPrCommentsPostOnRemoved';

export function SnapshotPrCommentsToggle() {
  const {project} = useProjectSettingsOutlet();
  const {mutate: updateProject} = useUpdateProject(project);

  const enabled =
    (project[ENABLED_WRITE_KEY] ?? project.options?.[ENABLED_READ_KEY]) !== false;
  const onlyIfDiff =
    (project[ONLY_IF_DIFF_WRITE_KEY] ?? project.options?.[ONLY_IF_DIFF_READ_KEY]) ===
    true;
  const postOnAdded =
    (project[POST_ON_ADDED_WRITE_KEY] ?? project.options?.[POST_ON_ADDED_READ_KEY]) ===
    true;
  const postOnRemoved =
    (project[POST_ON_REMOVED_WRITE_KEY] ??
      project.options?.[POST_ON_REMOVED_READ_KEY]) !== false;

  function handleUpdate(payload: Record<string, boolean>) {
    addLoadingMessage(t('Saving...'));
    updateProject(payload, {
      onSuccess: () => {
        addSuccessMessage(t('PR comment settings updated'));
      },
      onError: () => {
        addErrorMessage(t('Failed to save changes. Please try again.'));
      },
    });
  }

  return (
    <Panel>
      <PanelHeader>{t('Snapshots - Pull Request Comments')}</PanelHeader>
      <PanelBody>
        <Fragment>
          <Flex
            align="center"
            justify="between"
            padding="xl"
            borderBottom={enabled ? 'primary' : undefined}
          >
            <Stack gap="xs">
              <Text size="lg" bold>
                {t('Snapshot Pull Request Comments')}
              </Text>
              <Text size="sm" variant="muted">
                {t('Post snapshot comparison results as comments on pull requests.')}
              </Text>
            </Stack>
            <Switch
              size="lg"
              checked={enabled}
              onChange={() => handleUpdate({[ENABLED_WRITE_KEY]: !enabled})}
              aria-label={t('Toggle snapshot PR comments')}
            />
          </Flex>

          {enabled ? (
            <Stack padding="xl" gap="lg">
              <Flex align="center" justify="between">
                <Stack gap="xs">
                  <Text bold>{t('Only post when there are changes')}</Text>
                  <Text size="sm" variant="muted">
                    {t(
                      'Skip posting the PR comment when no snapshots differ from the base build.'
                    )}
                  </Text>
                </Stack>
                <Switch
                  checked={onlyIfDiff}
                  onChange={() => handleUpdate({[ONLY_IF_DIFF_WRITE_KEY]: !onlyIfDiff})}
                  aria-label={t('Toggle only post when there are changes')}
                />
              </Flex>
              {onlyIfDiff ? (
                <Fragment>
                  <Flex align="center" justify="between">
                    <Stack gap="xs">
                      <Text bold>{t('Post on Added Snapshots')}</Text>
                      <Text size="sm" variant="muted">
                        {t('Treat new snapshots as a change worth posting a PR comment.')}
                      </Text>
                    </Stack>
                    <Switch
                      checked={postOnAdded}
                      onChange={() =>
                        handleUpdate({[POST_ON_ADDED_WRITE_KEY]: !postOnAdded})
                      }
                      aria-label={t('Toggle post on added snapshots')}
                    />
                  </Flex>
                  <Flex align="center" justify="between">
                    <Stack gap="xs">
                      <Text bold>{t('Post on Removed Snapshots')}</Text>
                      <Text size="sm" variant="muted">
                        {t(
                          'Treat removed snapshots as a change worth posting a PR comment.'
                        )}
                      </Text>
                    </Stack>
                    <Switch
                      checked={postOnRemoved}
                      onChange={() =>
                        handleUpdate({[POST_ON_REMOVED_WRITE_KEY]: !postOnRemoved})
                      }
                      aria-label={t('Toggle post on removed snapshots')}
                    />
                  </Flex>
                </Fragment>
              ) : null}
            </Stack>
          ) : null}
        </Fragment>
      </PanelBody>
    </Panel>
  );
}
