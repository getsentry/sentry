import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconDelete, IconEdit} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {DataForwarderDeleteConfirm} from 'sentry/views/settings/organizationDataForwarding/components/dataForwarderDeleteConfirm';
import {
  ProviderLabels,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function DataForwarderRow({
  dataForwarder,
  disabled,
}: {
  dataForwarder: DataForwarder;
  disabled: boolean;
}) {
  const organization = useOrganization();
  return (
    <Container padding="xl" border="muted" radius="md" key={dataForwarder.id}>
      <Grid columns="auto 1fr auto" align="center" gap="md">
        <PluginIcon pluginId={dataForwarder.provider} size={32} />
        <Flex direction="column" gap="xs">
          <Flex align="center" gap="md">
            <Text bold>
              {tct('[provider] Data Forwarder', {
                provider: ProviderLabels[dataForwarder.provider],
              })}
            </Text>
            <Tag variant={dataForwarder.isEnabled ? 'success' : 'danger'}>
              {dataForwarder.isEnabled ? t('Enabled') : t('Disabled')}
            </Tag>
          </Flex>
          <Text size="sm" variant="muted">
            {getDataForwarderProjectText(dataForwarder)}
          </Text>
        </Flex>
        <ButtonBar>
          <LinkButton
            icon={<IconEdit />}
            to={`/settings/${organization.slug}/data-forwarding/${dataForwarder.id}/edit/`}
            onClick={() => {
              trackAnalytics('data_forwarding.edit_clicked', {organization});
            }}
            disabled={disabled}
          >
            {t('Edit')}
          </LinkButton>
          <DataForwarderDeleteConfirm dataForwarder={dataForwarder}>
            <Button
              title={t('Delete Data Forwarder')}
              aria-label={t('Delete Data Forwarder')}
              icon={<IconDelete />}
              // Deletions are always permitted, even if you lose the feature.
              disabled={false}
            />
          </DataForwarderDeleteConfirm>
        </ButtonBar>
      </Grid>
    </Container>
  );
}

function getDataForwarderProjectText(dataForwarder: DataForwarder) {
  const count = dataForwarder.enrolledProjects.length;
  const projectText =
    count > 0
      ? dataForwarder.isEnabled
        ? tn('Enabled for %s project', 'Enabled for %s projects', count)
        : tn('Configured for %s project', 'Configured for %s projects', count)
      : t('Not connected to any projects');
  return dataForwarder.enrollNewProjects
    ? projectText.concat(t(', will auto-enroll new projects'))
    : projectText;
}
