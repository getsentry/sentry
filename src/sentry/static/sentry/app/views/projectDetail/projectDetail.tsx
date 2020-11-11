import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import pick from 'lodash/pick';
import styled from '@emotion/styled';
import PlatformIcon from 'platformicons';

import {t} from 'app/locale';
import {
  Organization,
  ReleaseProject,
  ReleaseMeta,
  Deploy,
  GlobalSelection,
  ReleaseWithHealth,
  Project,
  AvatarProject,
} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {formatVersion} from 'app/utils/formatters';
import AsyncComponent from 'app/components/asyncComponent';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconInfo, IconSettings, IconSiren, IconWarning} from 'app/icons';
import space from 'app/styles/space';
import Alert from 'app/components/alert';
import * as Layout from 'app/components/layouts/thirds';
import Breadcrumbs, {Crumb} from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import Access from 'app/components/acl/access';

import ReleaseHeader from './releaseHeader';
import PickProjectToContinue from './pickProjectToContinue';
import ButtonBar from 'app/components/buttonBar';
import SearchBar from 'app/components/searchBar';
import ProjectAvatar from 'app/components/avatar/projectAvatar';
import ProjectBadge from 'app/components/idBadge/projectBadge';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = {
  project?: Project;
} & AsyncView['state'];

class ProjectDetailContainer extends AsyncView<Props, State> {
  getTitle() {
    const {params, organization} = this.props;

    return routeTitleGen(t('Project %s', params.projectId), organization.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    return [['project', `/projects/${params.orgId}/${params.projectId}/`]];
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  renderBody() {
    const {organization, params} = this.props;
    const {project} = this.state;

    console.log(project);

    return (
      <GlobalSelectionHeader shouldForceProject forceProject={project}>
        <LightWeightNoProjectMessage organization={organization}>
          <StyledPageContent>
            <Layout.Header>
              <Layout.HeaderContent>
                <Breadcrumbs
                  crumbs={[{label: t('Projects')}, {label: t('Project Details')}]}
                />
                <Layout.Title>
                  <ProjectBadge project={project!} />
                </Layout.Title>
              </Layout.HeaderContent>

              <Layout.HeaderActions>
                <ButtonBar gap={1}>
                  <Button
                    to={`/settings/${organization.slug}/projects/${params.projectId}/`}
                  >
                    {t('View All Issues')}
                  </Button>
                  <Access organization={organization} access={['project:write']}>
                    {({hasAccess}) => (
                      <Button
                        type="button"
                        disabled={!hasAccess}
                        title={
                          !hasAccess
                            ? t(
                                'Users with admin permission or higher can create alert rules.'
                              )
                            : undefined
                        }
                        icon={<IconSiren />}
                        to={`/organizations/${organization.slug}/alerts/${params.projectId}/new/`}
                      >
                        {t('Create alert')}
                      </Button>
                    )}
                  </Access>
                  <Button
                    icon={<IconSettings />}
                    label={t('Settings')}
                    to={`/settings/${organization.slug}/projects/${params.projectId}/`}
                  />
                </ButtonBar>
              </Layout.HeaderActions>
            </Layout.Header>

            <Layout.Body>
              <Layout.Main>
                <h4>main</h4>
                <p>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. Aut eius
                  mollitia maiores dolorum possimus animi, quasi sapiente facilis, eum
                  necessitatibus dicta corporis eaque excepturi. Molestiae, ipsa? At,
                  laborum possimus. Reiciendis?
                </p>
              </Layout.Main>
              <Layout.Side>
                <h4>sidebar</h4>
                <p>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. Cumque
                  doloremque ut perferendis harum, optio temporibus eaque officia, illo
                  est quia animi eum sunt dolorem in eligendi quod, corrupti dolores
                  doloribus!
                </p>
              </Layout.Side>
            </Layout.Body>
          </StyledPageContent>
        </LightWeightNoProjectMessage>
      </GlobalSelectionHeader>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export default ProjectDetailContainer;
