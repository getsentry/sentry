import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';

type LeftNavViewsHeaderProps = {
  onRealtimeChange: (realtime: boolean) => void;
  organization: Organization;
  realtimeActive: boolean;
  selectedProjectIds: number[];
};

function LeftNavViewsHeader({
  organization,
  realtimeActive,
  onRealtimeChange,
  selectedProjectIds,
}: LeftNavViewsHeaderProps) {
  const {projects} = useProjects();
  const {viewId} = useParams<{orgId?: string; viewId?: string}>();

  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );
  const realtimeTitle = realtimeActive
    ? t('Pause real-time updates')
    : t('Enable real-time updates');

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
  });

  const viewTitle = groupSearchViews?.find(v => v.id === viewId)?.name;

  return (
    <Layout.Header noActionWrap>
      <Layout.HeaderContent>
        <Layout.Title>{viewTitle ?? t('Issues')}</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <Button
            size="sm"
            data-test-id="real-time"
            title={realtimeTitle}
            aria-label={realtimeTitle}
            icon={realtimeActive ? <IconPause /> : <IconPlay />}
            onClick={() => onRealtimeChange(!realtimeActive)}
          />
        </ButtonBar>
      </Layout.HeaderActions>
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
