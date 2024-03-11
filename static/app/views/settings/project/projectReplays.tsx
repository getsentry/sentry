import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import formGroups from 'sentry/data/forms/replay';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type RouteParams = {
  projectId: string;
};
type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  project: Project;
};

class ProjectReplaySettings extends DeprecatedAsyncView<Props> {
  submitTimeout: number | undefined = undefined;

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;
    return [['project', `/projects/${organization.slug}/${projectId}/`]];
  }

  getTitle(): string {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Replays'), projectId, false);
  }

  renderBody() {
    const {organization, project} = this.props;
    const {projectId} = this.props.params;

    return (
      <div>
        <SettingsPageHeader
          title={t('Replays')}
          action={
            <ButtonList>
              <Button
                external
                href="https://docs.sentry.io/product/session-replay/replay-page-and-filters/"
              >
                {t('Read the docs')}
              </Button>
            </ButtonList>
          }
        />
        <PermissionAlert project={project} />
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint={`/projects/${organization.slug}/${projectId}/`}
          initialData={this.state.project.options}
        >
          <Access access={['project:write']} project={project}>
            {({hasAccess}) => <JsonForm disabled={!hasAccess} forms={formGroups} />}
          </Access>
        </Form>
      </div>
    );
  }
}

export default ProjectReplaySettings;

const ButtonList = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
`;
