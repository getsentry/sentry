import styled from '@emotion/styled';

import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
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

  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
  });

  const viewTitle = groupSearchViews?.find(v => v.id === viewId)?.name;

  return (
    <StyledHeader noActionWrap>
      <StyledHeaderContent>
        <Layout.Title>{viewTitle ?? t('Issues')}</Layout.Title>
      </StyledHeaderContent>
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
    </StyledHeader>
  );
}

export default LeftNavViewsHeader;

const StyledHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
  border: 0;
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
`;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;
