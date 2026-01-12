import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';
import {Link} from '@sentry/scraps/link/link';
import {Switch} from '@sentry/scraps/switch/switch';
import {Text} from '@sentry/scraps/text/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {
  AutofixAutomationSettings,
  useUpdateBulkAutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import useOrganization from 'sentry/utils/useOrganization';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  autofixSettings: AutofixAutomationSettings;
  isFetchingSettings: boolean;
  project: Project;
  updateBulkAutofixAutomationSettings: ReturnType<
    typeof useUpdateBulkAutofixAutomationSettings
  >['mutate'];
}

export default function SeerProjectTableRow({
  autofixSettings,
  isFetchingSettings,
  updateBulkAutofixAutomationSettings,
  project,
}: Props) {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isSelected, toggleSelected} = useListItemCheckboxContext();

  // We used to support multiple sensitivity values for Auto-Fix. Now we only support 'off' and 'medium'.
  // If any other value is set, we treat it as 'medium'.
  const hasAutoFixEnabled =
    autofixSettings.autofixAutomationTuning !== undefined &&
    autofixSettings.autofixAutomationTuning !== 'off';

  // We used to have multiple stopping points for PR Creation.
  // `code_changes` means seer will output code changes, and you can copy and paste them into a new branch.
  // `open_pr` means seer will take those changes and push a PR for you.
  // `background_agent` is a special value that indicates that the PR creation is delegated to a background agent.
  // All other values are treated as `code_changes`. Which means both checkboxes will be unchecked.
  const hasCreatePREnabled = autofixSettings.automatedRunStoppingPoint === 'open_pr';
  const hasDelegationEnabled =
    autofixSettings.automatedRunStoppingPoint === 'background_agent';

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
            checked={hasAutoFixEnabled}
            onChange={e => {
              const autofixAutomationTuning = e.target.checked ? 'medium' : 'off';
              addLoadingMessage(t('Updating Auto-Fix for %s', project.name));
              updateBulkAutofixAutomationSettings(
                {projectIds: [project.id], autofixAutomationTuning},
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
        {hasDelegationEnabled ? (
          <Flex align="center" gap="sm">
            {'n/a'}
            <QuestionTooltip
              title={t('This setting does not apply to background agents.')}
              size="xs"
            />
          </Flex>
        ) : isFetchingSettings ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            disabled={!canWrite}
            checked={hasCreatePREnabled}
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
          <Flex align="center" gap="sm">
            <Switch
              disabled={!canWrite || !hasDelegationEnabled}
              checked={hasDelegationEnabled}
              onChange={() => {
                // This preference can only be turned off, not on, from here.
                // You need to go to the project settings page to turn it on.
                addLoadingMessage(t('Updating background agent for %s', project.name));
                updateBulkAutofixAutomationSettings(
                  {
                    projectIds: [project.id],
                    automatedRunStoppingPoint: 'background_agent',
                  },
                  {
                    onError: () =>
                      addErrorMessage(
                        t('Failed to update background agent for %s', project.name)
                      ),
                    onSuccess: () =>
                      addSuccessMessage(
                        t('Updated background agent for %s', project.name)
                      ),
                  }
                );
              }}
            />
          </Flex>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isFetchingSettings ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Text tabular>{autofixSettings.reposCount || 0}</Text>
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
