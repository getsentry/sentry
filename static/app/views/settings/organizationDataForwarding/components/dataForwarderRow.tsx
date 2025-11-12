import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import Confirm from 'sentry/components/confirm';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import useOrganization from 'sentry/utils/useOrganization';
import {useDeleteDataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import {
  ProviderLabels,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function DataForwarderRow({dataForwarder}: {dataForwarder: DataForwarder}) {
  const organization = useOrganization();
  const {mutate: deleteDataForwarder} = useDeleteDataForwarder({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder?.id},
  });
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
            <Tag type={dataForwarder.isEnabled ? 'success' : 'error'}>
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
          >
            {t('Edit')}
          </LinkButton>
          <Confirm
            message={t(
              'Are you sure you want to delete this data forwarder? All configuration, both global and project-level will be lost.'
            )}
            confirmText={t('Delete')}
            priority="danger"
            onConfirm={() => {
              deleteDataForwarder({
                dataForwarderId: dataForwarder.id,
                orgSlug: organization.slug,
              });
            }}
          >
            <Button
              title={t('Delete Data Forwarder')}
              aria-label={t('Delete Data Forwarder')}
              icon={<IconDelete />}
            />
          </Confirm>
        </ButtonBar>
      </Grid>
    </Container>
  );
}

function getDataForwarderProjectText(dataForwarder: DataForwarder) {
  let projectText = '';
  if (dataForwarder.enrolledProjects.length === 0) {
    projectText = t('Not connected to any projects');
  }
  const action = dataForwarder.isEnabled ? t('Enabled') : t('Configured');
  const count = dataForwarder.enrolledProjects.length;
  projectText = t('%s for %s projects', action, count);
  if (dataForwarder.enrollNewProjects) {
    projectText += t(', will auto-enroll new projects');
  }
  return projectText;
}
