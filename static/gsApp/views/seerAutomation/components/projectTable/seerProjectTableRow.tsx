import styled from '@emotion/styled';
import type {UseQueryResult} from '@tanstack/react-query';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';
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
import type {PreferredAgent} from 'sentry/utils/seer/preferredAgent';
import {
  getProjectStoppingPointValueFromSettings,
  type MutateStoppingPoint,
  PROJECT_STOPPING_POINT_OPTIONS,
} from 'sentry/utils/seer/stoppingPoint';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useMutateSelectedAgent,
  useSelectedAgentFromBulkSettings,
} from 'sentry/views/settings/seer/seerAgentHooks';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  agentOptions: UseQueryResult<Array<{label: string; value: PreferredAgent}>>;
  autofixSettings: undefined | AutofixAutomationSettings;
  integrations: CodingAgentIntegration[];
  isPendingIntegrations: boolean;
  mutateStoppingPoint: MutateStoppingPoint;
  project: Project;
}

export function SeerProjectTableRow({
  agentOptions,
  autofixSettings,
  integrations,
  isPendingIntegrations,
  mutateStoppingPoint,
  project,
}: Props) {
  const location = useLocation();
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

  const stoppingPointValue = autofixSettings
    ? getProjectStoppingPointValueFromSettings(autofixSettings)
    : 'off';

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
        <Link
          to={{
            pathname: `/settings/${organization.slug}/seer/projects/${project.slug}/`,
            query: location.query,
          }}
        >
          <ProjectBadge disableLink project={project} avatarSize={16} />
        </Link>
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
      <SimpleTable.RowCell justify="end" align="stretch" overflow="visible">
        {autofixSettings ? (
          <Stack align="stretch" flex="1">
            <Select
              size="xs"
              disabled={!canWrite}
              name="stoppingPoint"
              options={PROJECT_STOPPING_POINT_OPTIONS}
              value={stoppingPointValue}
              onChange={option => {
                mutateStoppingPoint(
                  {stoppingPoint: option.value, project},
                  {
                    onSuccess: () =>
                      addSuccessMessage(
                        tct('Updated automation steps for [project]', {
                          project: project.name,
                        })
                      ),
                    onError: () =>
                      addErrorMessage(
                        t('Failed to update automation steps for %s', project.name)
                      ),
                  }
                );
              }}
            />
          </Stack>
        ) : (
          <Placeholder height="28px" width="100%" />
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
