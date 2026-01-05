import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconRefresh} from 'sentry/icons';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {getProjectOverrideForm} from 'sentry/views/settings/organizationDataForwarding/util/forms';
import {useMutateDataForwarderProject} from 'sentry/views/settings/organizationDataForwarding/util/hooks';
import type {DataForwarder} from 'sentry/views/settings/organizationDataForwarding/util/types';

export function ProjectOverrideForm({
  project,
  dataForwarder,
  disabled,
}: {
  dataForwarder: DataForwarder;
  disabled: boolean;
  project: AvatarProject;
}) {
  const organization = useOrganization();
  const formModel = useMemo(() => new FormModel(), []);
  const {mutate: updateDataForwarder} = useMutateDataForwarderProject({
    params: {orgSlug: organization.slug, dataForwarderId: dataForwarder.id, project},
    onSuccess: () => {
      trackAnalytics('data_forwarding.edit_override_complete', {
        organization,
        platform: project.platform,
        provider: dataForwarder.provider,
      });
    },
  });

  const projectConfig = dataForwarder.projectConfigs.find(
    config => config.project.id === project.id
  );

  useEffect(() => {
    formModel.setInitialData({
      is_enabled: projectConfig?.isEnabled ?? false,
      ...projectConfig?.overrides,
    });
  }, [projectConfig, formModel, project.id]);

  return (
    <Form
      model={formModel}
      onSubmit={data => {
        const {is_enabled, ...overrides} = data;
        updateDataForwarder({
          project_id: `${project.id}`,
          overrides,
          is_enabled,
        });
      }}
      hideFooter
    >
      <OverrideForm
        disabled={disabled}
        forms={[getProjectOverrideForm({dataForwarder, project, omitTag: disabled})]}
        collapsible
        renderHeader={() => (
          <Flex padding="sm lg" borderBottom="primary" gap="md" align="center">
            <IconInfo size="sm" color="subText" />
            <Text variant="muted" size="sm" bold>
              {t('Overrides set here will only affect this project')}
            </Text>
          </Flex>
        )}
        renderFooter={() => (
          <Flex justify="between" padding="lg xl">
            <Button
              size="sm"
              icon={<IconRefresh color="danger" transform="scale(-1, 1)" />}
              disabled={disabled}
              onClick={() => {
                updateDataForwarder({
                  project_id: `${project.id}`,
                  overrides: {},
                  is_enabled: projectConfig?.isEnabled ?? false,
                });
              }}
            >
              {t('Clear Override')}
            </Button>
            <Button priority="primary" size="sm" type="submit" disabled={disabled}>
              {t('Save Override')}
            </Button>
          </Flex>
        )}
      />
    </Form>
  );
}

const OverrideForm = styled(JsonForm)`
  ${Panel} {
    margin: 0;
  }
  ${PanelHeader} {
    text-transform: none;
    background: ${p => p.theme.backgroundSecondary};
    padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  }
  margin: 0;
`;
