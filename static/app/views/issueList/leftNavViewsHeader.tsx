import styled from '@emotion/styled';

import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';

type LeftNavViewsHeaderProps = {
  selectedProjectIds: number[];
};

function LeftNavViewsHeader({selectedProjectIds}: LeftNavViewsHeaderProps) {
  const {projects} = useProjects();
  const organization = useOrganization();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();
  const prefersStackedNav = usePrefersStackedNav();

  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
  });

  const viewTitle = groupSearchViews?.find(v => v.id === viewId)?.name;

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <Layout.Title>{viewTitle ?? t('Issues')}</Layout.Title>
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
