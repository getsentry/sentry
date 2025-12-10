import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar/projectAvatar';
import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';
import {Link} from '@sentry/scraps/link/link';
import {Switch} from '@sentry/scraps/switch/switch';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectAutomation} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectAutomation';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  organization: Organization;
  project: Project;
}

export default function SeerProjectTableRow({project, organization}: Props) {
  const canWrite = useCanWriteSettings();
  const {isSelected, toggleSelected} = useListItemCheckboxContext();

  const {data: detailedProject, isPending: isLoadingDetailedProject} = useDetailedProject(
    {
      orgSlug: organization.slug,
      projectSlug: project.slug,
    }
  );

  const {
    preference,
    isPending: isLoadingPreferences,
    codeMappingRepos,
  } = useProjectSeerPreferences(project);

  const {mutate: mutateProject} = useUpdateProjectAutomation(project);
  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  // We used to support multiple sensitivity values for Auto-Fix. Now we only support 'off' and 'medium'.
  // If any other value is set, we treat it as 'medium'.
  const hasAutoFixEnabled =
    detailedProject?.autofixAutomationTuning !== undefined &&
    detailedProject?.autofixAutomationTuning !== 'off';

  // We used to have multiple stopping points for PR Creation. Now we only support 'open_pr' and 'code_changes'.
  // If any other value is set, we treat it as 'code_changes'.
  // `background_agent` is a special value that indicates that the PR creation is delegated to a background agent.
  const hasCreatePREnabled =
    preference?.automated_run_stopping_point !== undefined &&
    preference?.automated_run_stopping_point !== 'background_agent';
  const hasDelegationEnabled =
    preference?.automated_run_stopping_point === 'background_agent';

  return (
    <SimpleTable.Row key={project.id}>
      <SimpleTable.RowCell>
        <CheckboxClickTarget htmlFor={`replay-table-select-${project.id}`}>
          <Checkbox
            id={`replay-table-select-${project.id}`}
            disabled={isSelected(project.id) === 'all-selected'}
            checked={isSelected(project.id) !== false}
            onChange={() => {
              toggleSelected(project.id);
            }}
          />
        </CheckboxClickTarget>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Link to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}>
          <Flex gap="md" align="center">
            <ProjectAvatar project={project} />
            {project.name}
          </Flex>
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isLoadingDetailedProject ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            disabled={!canWrite}
            checked={hasAutoFixEnabled}
            onChange={e => {
              const autofixAutomationTuning = e.target.checked ? 'medium' : 'off';
              mutateProject(
                {autofixAutomationTuning, seerScannerAutomation: true},
                {
                  onError: () => {
                    addErrorMessage(t('Problem updating Auto-Fix for %s', project.name));
                  },
                  onSuccess: () => {
                    addSuccessMessage(t('Auto-Fix updated for %s', project.name));
                  },
                }
              );
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {hasDelegationEnabled ? (
          'n/a'
        ) : isLoadingPreferences ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            disabled={!canWrite}
            checked={hasCreatePREnabled}
            onChange={e => {
              const automatedRunStoppingPoint = e.target.checked
                ? 'open_pr'
                : 'code_changes';
              updateProjectSeerPreferences(
                {
                  repositories: preference?.repositories || [],
                  automated_run_stopping_point: automatedRunStoppingPoint,
                  automation_handoff: preference?.automation_handoff,
                },
                {
                  onError: () => {
                    addErrorMessage(
                      t('Problem updating PR Creation for %s', project.name)
                    );
                  },
                  onSuccess: () => {
                    addSuccessMessage(t('PR Creation updated for %s', project.name));
                  },
                }
              );
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isLoadingPreferences ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Flex align="center" gap="sm">
            <Switch
              disabled={!canWrite || !hasDelegationEnabled}
              checked={hasDelegationEnabled}
              onChange={() => {
                updateProjectSeerPreferences(
                  {
                    repositories: preference?.repositories || [],
                    automated_run_stopping_point: 'background_agent',
                    automation_handoff: preference?.automation_handoff,
                  },
                  {
                    onError: () => {
                      addErrorMessage(
                        t('Failed to update Cursor Agent for %s', project.name)
                      );
                    },
                    onSuccess: () => {
                      addSuccessMessage(t('Updated Cursor Agent for %s', project.name));
                    },
                  }
                );
              }}
            />
            {hasDelegationEnabled ? null : (
              <QuestionTooltip
                title={t(
                  'Enable delegation to a background agent on the project settings page.'
                )}
                size="xs"
              />
            )}
          </Flex>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        {isLoadingPreferences ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          preference?.repositories?.length || codeMappingRepos?.length || 0
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
