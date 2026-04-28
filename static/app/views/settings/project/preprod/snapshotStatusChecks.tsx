import {Fragment} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {useSnapshotStatusChecks} from './useSnapshotStatusChecks';

export function SnapshotStatusChecks() {
  const {project} = useProjectSettingsOutlet();
  const {
    enabled,
    failOnAdded,
    failOnRemoved,
    setEnabled,
    setFailOnAdded,
    setFailOnRemoved,
  } = useSnapshotStatusChecks(project);

  return (
    <Panel>
      <PanelHeader>{t('Snapshots - Status Checks')}</PanelHeader>
      <PanelBody>
        <Fragment>
          <Flex align="center" justify="between" padding="xl" borderBottom="primary">
            <Stack gap="xs">
              <Text size="lg" bold>
                {t('Snapshot Status Checks Enabled')}
              </Text>
              <Text size="sm" variant="muted">
                {t(
                  'Sentry will post status checks based on snapshot changes in your builds.'
                )}
              </Text>
            </Stack>
            <Switch
              size="lg"
              checked={enabled}
              onChange={() => setEnabled(!enabled)}
              aria-label={t('Toggle snapshot status checks')}
            />
          </Flex>

          {enabled ? (
            <Stack padding="xl" gap="lg">
              <Flex align="center" justify="between">
                <Stack gap="xs">
                  <Text bold>{t('Fail on Added Snapshots')}</Text>
                  <Text size="sm" variant="muted">
                    {t('Status check will fail if new snapshots are added in a build.')}
                  </Text>
                </Stack>
                <Switch
                  checked={failOnAdded}
                  onChange={() => setFailOnAdded(!failOnAdded)}
                  aria-label={t('Toggle fail on added snapshots')}
                />
              </Flex>
              <Flex align="center" justify="between">
                <Stack gap="xs">
                  <Text bold>{t('Fail on Removed Snapshots')}</Text>
                  <Text size="sm" variant="muted">
                    {t('Status check will fail if snapshots are removed from a build.')}
                  </Text>
                </Stack>
                <Switch
                  checked={failOnRemoved}
                  onChange={() => setFailOnRemoved(!failOnRemoved)}
                  aria-label={t('Toggle fail on removed snapshots')}
                />
              </Flex>
            </Stack>
          ) : (
            <Container padding="md">
              <Text align="center" variant="muted" italic>
                {t('Enable snapshot status checks above to configure.')}
              </Text>
            </Container>
          )}
        </Fragment>
      </PanelBody>
    </Panel>
  );
}
