import styled from '@emotion/styled';

import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {EditableIssueViewHeader} from 'sentry/views/issueList/editableIssueViewHeader';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

type LeftNavViewsHeaderProps = {
  selectedProjectIds: number[];
};

function PageTitle() {
  const organization = useOrganization();
  const {data: groupSearchView} = useSelectedGroupSearchView();

  if (organization.features.includes('issue-view-sharing')) {
    if (groupSearchView) {
      return <EditableIssueViewHeader view={groupSearchView} />;
    }

    return <Layout.Title>{t('Issues')}</Layout.Title>;
  }

  return <Layout.Title>{groupSearchView?.name ?? t('Issues')}</Layout.Title>;
}

function LeftNavViewsHeader({selectedProjectIds}: LeftNavViewsHeaderProps) {
  const {projects} = useProjects();
  const prefersStackedNav = usePrefersStackedNav();
  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <PageTitle />
      </Layout.HeaderContent>
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
    </Layout.Header>
  );
}

export default LeftNavViewsHeader;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;
