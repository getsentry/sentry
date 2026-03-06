import {Flex, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const READ_KEY = 'sentry:preprod_distribution_pr_comments_enabled';
const WRITE_KEY = 'preprodDistributionPrCommentsEnabled';

export function PrCommentsToggle() {
  const {project} = useProjectSettingsOutlet();
  const {mutate: updateProject} = useUpdateProject(project);

  const enabled = (project[WRITE_KEY] ?? project.options?.[READ_KEY]) !== false;

  return (
    <Panel>
      <PanelHeader>{t('Build Distribution - Pull Request Comments')}</PanelHeader>
      <PanelBody>
        <Flex align="center" justify="between" padding="xl">
          <Stack gap="xs">
            <Text size="lg" bold>
              {t('Build Distribution Pull Request Comments')}
            </Text>
            <Text size="sm" variant="muted">
              {t('Post build distribution install links as comments on pull requests.')}
            </Text>
          </Stack>
          <Switch
            size="lg"
            checked={enabled}
            onChange={() => updateProject({[WRITE_KEY]: !enabled})}
            aria-label={t('Toggle build distribution PR comments')}
          />
        </Flex>
      </PanelBody>
    </Panel>
  );
}
