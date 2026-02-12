import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {
  AutofixAutomationSettings,
  useUpdateBulkAutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import useOrganization from 'sentry/utils/useOrganization';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

const SEER_OPTION_VALUE = '__seer__';

interface Props {
  autofixSettings: AutofixAutomationSettings;
  isFetchingSettings: boolean;
  project: Project;
  supportedIntegrations: CodingAgentIntegration[];
  updateBulkAutofixAutomationSettings: ReturnType<
    typeof useUpdateBulkAutofixAutomationSettings
  >['mutate'];
}

export default function SeerProjectTableRow({
  autofixSettings,
  isFetchingSettings,
  updateBulkAutofixAutomationSettings,
  project,
  supportedIntegrations,
}: Props) {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isSelected, toggleSelected} = useListItemCheckboxContext();

  const isAutoFixEnabled = Boolean(
    autofixSettings.autofixAutomationTuning &&
    autofixSettings.autofixAutomationTuning !== 'off'
  );

  const isCreatePrEnabled = autofixSettings.automatedRunStoppingPoint !== 'code_changes';

  // Determine current coding agent value
  const handoff = autofixSettings.automationHandoff;
  let codingAgentValue = SEER_OPTION_VALUE;
  if (handoff?.target === 'cursor_background_agent' && handoff?.integration_id != null) {
    codingAgentValue = String(handoff.integration_id);
  }

  const codingAgentOptions = [
    {value: SEER_OPTION_VALUE, label: t('Seer')},
    ...supportedIntegrations.map(integration => ({
      value: String(integration.id),
      label: integration.name,
    })),
  ];

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
      <SimpleTable.RowCell justify="end">
        {isFetchingSettings ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            disabled={!canWrite}
            checked={isAutoFixEnabled}
            onChange={e => {
              addLoadingMessage(t('Updating Auto-Fix for %s', project.name));
              updateBulkAutofixAutomationSettings(
                {
                  projectIds: [project.id],
                  autofixAutomationTuning: e.target.checked ? 'medium' : 'off',
                },
                {
                  onError: () =>
                    addErrorMessage(t('Problem updating Auto-Fix for %s', project.name)),
                  onSuccess: () =>
                    addSuccessMessage(t('Auto-Fix updated for %s', project.name)),
                }
              );
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isFetchingSettings ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            disabled={
              organization.enableSeerCoding === false || !canWrite || !isAutoFixEnabled
            }
            checked={organization.enableSeerCoding !== false && isCreatePrEnabled}
            onChange={e => {
              const automatedRunStoppingPoint = e.target.checked
                ? 'open_pr'
                : 'code_changes';
              addLoadingMessage(t('Updating PR Creation for %s', project.name));
              updateBulkAutofixAutomationSettings(
                {projectIds: [project.id], automatedRunStoppingPoint},
                {
                  onError: () =>
                    addErrorMessage(
                      t('Problem updating PR Creation for %s', project.name)
                    ),
                  onSuccess: () =>
                    addSuccessMessage(t('PR Creation updated for %s', project.name)),
                }
              );
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isFetchingSettings ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <CompactSelect
            disabled={!canWrite}
            triggerProps={{size: 'xs'}}
            options={codingAgentOptions}
            value={codingAgentValue}
            onChange={option => {
              const isSeer = option.value === SEER_OPTION_VALUE;
              addLoadingMessage(t('Updating Coding Agent for %s', project.name));
              updateBulkAutofixAutomationSettings(
                {
                  projectIds: [project.id],
                  automationHandoff: isSeer
                    ? {
                        handoff_point: 'root_cause',
                        target: 'seer_coding_agent',
                      }
                    : {
                        handoff_point: 'root_cause',
                        target: 'cursor_background_agent',
                        integration_id: Number(option.value),
                      },
                },
                {
                  onError: () =>
                    addErrorMessage(
                      t('Problem updating Coding Agent for %s', project.name)
                    ),
                  onSuccess: () =>
                    addSuccessMessage(t('Coding Agent updated for %s', project.name)),
                }
              );
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isFetchingSettings ? (
          <Placeholder height="20px" width="36px" />
        ) : autofixSettings.reposCount === 0 ? (
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
