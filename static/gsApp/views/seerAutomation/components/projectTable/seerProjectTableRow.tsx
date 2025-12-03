import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar/projectAvatar';
import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';
import {Link} from '@sentry/scraps/link/link';
import {Switch} from '@sentry/scraps/switch/switch';

import {useProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerPreferences';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';

interface Props {
  organization: Organization;
  project: Project;
}

export default function SeerProjectTableRow({project, organization}: Props) {
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

  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const repoCount = preference?.repositories?.length || codeMappingRepos?.length || 0;

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
      <SimpleTable.RowCell>
        {isLoadingDetailedProject ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            checked={detailedProject?.seerScannerAutomation ?? false}
            onChange={() => {
              updateProjectSeerPreferences({
                repositories: preference?.repositories || [],
                automated_run_stopping_point: 'root_cause',
                automation_handoff: {
                  handoff_point: 'root_cause',
                  target: 'cursor_background_agent',
                  integration_id: parseInt(cursorIntegration.id, 10),
                  auto_create_pr: false,
                },
              });
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {isLoadingDetailedProject ? (
          <Placeholder height="20px" width="36px" />
        ) : (
          <Switch
            checked={(project.autofixAutomationTuning ?? 'off') !== 'off'}
            onChange={() => {
              // set to medium
              updateProjectSeerPreferences({
                repositories: preference?.repositories || [],
                automated_run_stopping_point: 'root_cause',
                automation_handoff: {
                  handoff_point: 'root_cause',
                  target: 'cursor_background_agent',
                  integration_id: parseInt(cursorIntegration.id, 10),
                  auto_create_pr: false,
                },
              });
            }}
          />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {isLoadingPreferences ? <Placeholder height="12px" width="50px" /> : repoCount}
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
