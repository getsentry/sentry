import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {PageContent} from 'app/styles/organization';
import routeTitleGen from 'app/utils/routeTitle';
import {IconSettings, IconSiren} from 'app/icons';
import * as Layout from 'app/components/layouts/thirds';
import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import Access from 'app/components/acl/access';
import ButtonBar from 'app/components/buttonBar';
import IdBadge from 'app/components/idBadge';
import TextOverflow from 'app/components/textOverflow';

import ProjectScoreCards from './projectScoreCards';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

type State = {
  project: Project | null;
} & AsyncView['state'];

class ProjectDetail extends AsyncView<Props, State> {
  getTitle() {
    const {params} = this.props;

    return routeTitleGen(t('Project %s', params.projectId), params.orgId, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {params} = this.props;
    return [['project', `/projects/${params.orgId}/${params.projectId}/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, params} = this.props;
    const {project} = this.state;

    return (
      <GlobalSelectionHeader shouldForceProject forceProject={project}>
        <LightWeightNoProjectMessage organization={organization}>
          <StyledPageContent>
            <Layout.Header>
              <Layout.HeaderContent>
                <Breadcrumbs
                  crumbs={[
                    {
                      to: `/organizations/${params.orgId}/projects/`,
                      label: t('Projects'),
                    },
                    {label: t('Project Details')},
                  ]}
                />
                <Layout.Title>
                  <TextOverflow>
                    {project && (
                      <IdBadge
                        project={project}
                        avatarSize={28}
                        displayName={params.projectId}
                      />
                    )}
                  </TextOverflow>
                </Layout.Title>
              </Layout.HeaderContent>

              <Layout.HeaderActions>
                <ButtonBar gap={1}>
                  <Button
                    to={`/organizations/${params.orgId}/issues/?project=${params.projectId}`}
                  >
                    {t('View All Issues')}
                  </Button>
                  <Access organization={organization} access={['project:write']}>
                    {({hasAccess}) => (
                      <Button
                        disabled={!hasAccess}
                        title={
                          !hasAccess
                            ? t(
                                'Users with admin permission or higher can create alert rules.'
                              )
                            : undefined
                        }
                        icon={<IconSiren />}
                        to={`/organizations/${params.orgId}/alerts/${params.projectId}/new/`}
                      >
                        {t('Create Alert')}
                      </Button>
                    )}
                  </Access>
                  <Button
                    icon={<IconSettings />}
                    label={t('Settings')}
                    to={`/settings/${params.orgId}/projects/${params.projectId}/`}
                  />
                </ButtonBar>
              </Layout.HeaderActions>
            </Layout.Header>

            <Layout.Body>
              <Layout.Main>
                <ProjectScoreCards />
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

export default ProjectDetail;
