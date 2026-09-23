import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';

export function ConnectedRepositoriesPanel() {
  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Connected Repositories')}
        <Button size="xs" icon={<IconAdd />}>
          {t('Connect repository')}
        </Button>
      </PanelHeader>
      <PanelBody>
        <Flex padding="xl">
          <Text variant="muted">{t('No repositories connected')}</Text>
        </Flex>
      </PanelBody>
    </Panel>
  );
}
