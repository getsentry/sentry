import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import projectSecurityAndPrivacyGroups from 'sentry/data/forms/projectSecurityAndPrivacyGroups';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';

interface StoreCrashReportsConfigProps {
  organization: Organization;
  projectSlug: Project['slug'];
}

export function StoreCrashReportsConfig({
  projectSlug,
  organization,
}: StoreCrashReportsConfigProps) {
  const {data: project, isPending: isPendingProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  if (isPendingProject) {
    // 72px is the height of the form
    return <Placeholder height="72px" />;
  }

  const storeCrashReportsField = projectSecurityAndPrivacyGroups
    .flatMap(group => group.fields)
    .find(field => field.name === 'storeCrashReports');

  if (!project || !storeCrashReportsField) {
    return null;
  }

  return (
    <Form
      saveOnBlur
      allowUndo
      initialData={project}
      apiMethod="PUT"
      apiEndpoint={`/projects/${organization.slug}/${projectSlug}/`}
      onSubmitSuccess={data => {
        // This will update our project global state
        ProjectsStore.onUpdateSuccess(data);
      }}
      onSubmitError={() => addErrorMessage('Unable to save change')}
    >
      <StyledJsonForm
        features={new Set(organization.features)}
        additionalFieldProps={{organization, project}}
        disabled={!hasEveryAccess(['project:write'], {organization, project})}
        forms={[
          {
            title: '', // we do not want to show the panel's header
            fields: [storeCrashReportsField],
          },
        ]}
      />
    </Form>
  );
}

const StyledJsonForm = styled(JsonForm)`
  ${Panel} {
    margin-bottom: 0;
  }
`;
