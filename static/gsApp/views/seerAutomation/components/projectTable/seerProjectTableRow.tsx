import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {AutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {useFetchAgentOptions} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';
import {
  useMutateCreatePr,
  useMutateSelectedAgent,
  useSelectedAgentFromBulkSettings,
} from 'sentry/views/settings/seer/seerAgentHooks';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  agentOptions: ReturnType<typeof useFetchAgentOptions>;
  autofixSettings: undefined | AutofixAutomationSettings;
  integrations: CodingAgentIntegration[];
  isPendingIntegrations: boolean;
  project: Project;
}

export function SeerProjectTableRow({
  agentOptions,
  autofixSettings,
  integrations,
  isPendingIntegrations,
  project,
}: Props) {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isSelected, toggleSelected} = useListItemCheckboxContext();

  const autofixAgent = useSelectedAgentFromBulkSettings({
    autofixSettings: autofixSettings ?? {
      autofixAutomationTuning: 'off',
      automatedRunStoppingPoint: 'code_changes',
      automationHandoff: undefined,
      projectId: project.id,
      reposCount: 0,
    },
    integrations: integrations ?? [],
  });

  const mutateSelectedAgent = useMutateSelectedAgent({project});
  const mutateCreatePr = useMutateCreatePr({project});

  const isCreatePrEnabled = autofixSettings
    ? autofixAgent === 'seer'
      ? organization.enableSeerCoding !== false &&
        autofixSettings.automatedRunStoppingPoint !== 'code_changes'
      : (autofixSettings.automationHandoff?.auto_create_pr ?? false)
    : false;

  return (
    <SimpleTable.Row key={project.id}>
      <SimpleTable.RowCell>
        <CheckboxClickTarget htmlFor={`replay-table-select-${project.id}`}>
          <Checkbox
            id={`replay-table-select-${project.id}`}
            disabled={isSelected(project.id) === 'all-selected'}
            checked={isSelected(project.id) !== false}
            onChange={() => toggleSelected(project.id)}
          />
        </CheckboxClickTarget>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Link to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}>
          <ProjectBadge disableLink project={project} avatarSize={16} />
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" align="stretch" overflow="visible">
        {!autofixSettings || isPendingIntegrations ? (
          <Placeholder height="28px" width="100%" />
        ) : (
          <Stack align="stretch" flex="1">
            <Select
              size="xs"
              disabled={!canWrite}
              name="autofixAgent"
              options={agentOptions.data ?? []}
              value={autofixAgent ?? 'seer'}
              onChange={option => {
                mutateSelectedAgent(option.value, {
                  onSuccess: () => {
                    addSuccessMessage(
                      tct('Selected [name] for [project]', {
                        name: <strong>{option.label}</strong>,
                        project: project.name,
                      })
                    );
                  },
                  onError: () =>
                    addErrorMessage(
                      tct('Failed to set [name] for [project]', {
                        name: <strong>{option.label}</strong>,
                        project: project.name,
                      })
                    ),
                });
              }}
            />
          </Stack>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {autofixSettings ? (
          <Flex align="center" gap="sm">
            {organization.enableSeerCoding === false && autofixAgent === 'seer' ? (
              <InfoTip
                title={tct(
                  '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                  {
                    settings: (
                      <Link
                        to={`/settings/${organization.slug}/seer/#enableSeerCoding`}
                      />
                    ),
                  }
                )}
                size="xs"
              />
            ) : null}

            <Switch
              disabled={
                !canWrite ||
                (organization.enableSeerCoding === false && autofixAgent === 'seer')
              }
              checked={isCreatePrEnabled}
              onChange={e => {
                const value = e.target.checked;
                mutateCreatePr(autofixAgent, value, {
                  onSuccess: () =>
                    addSuccessMessage(
                      value
                        ? t('Enabled auto create pull requests for %s', project.name)
                        : t('Disabled auto create pull requests for %s', project.name)
                    ),
                  onError: () =>
                    addErrorMessage(
                      t(
                        'Failed to update auto create pull requests setting for %s',
                        project.name
                      )
                    ),
                });
              }}
            />
          </Flex>
        ) : (
          <Placeholder height="28px" width="36px" />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {autofixSettings ? (
          autofixSettings.reposCount === 0 ? (
            <Tooltip
              title={t('Seer works best on projects with at least one connected repo.')}
            >
              <Flex align="center" gap="sm">
                <IconWarning variant="warning" />
                <Text tabular>{0}</Text>
              </Flex>
            </Tooltip>
          ) : (
            <Text tabular>{autofixSettings.reposCount}</Text>
          )
        ) : (
          <Placeholder height="28px" width="36px" />
        )}
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

const CheckboxClickTarget = styled('label')`
  cursor: pointer;
  display: block;
  margin: -${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
  max-width: unset;
  line-height: 0;
`;
