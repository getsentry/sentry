import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {DashboardRevision} from 'sentry/actionCreators/dashboards';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconClock} from 'sentry/icons/iconClock';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useDashboardRevisions} from './hooks/useDashboardRevisions';
import type {DashboardDetails} from './types';

interface DashboardRevisionsButtonProps {
  dashboard: DashboardDetails;
}

export function DashboardRevisionsButton({dashboard}: DashboardRevisionsButtonProps) {
  const organization = useOrganization();

  const isValidDashboard =
    !!dashboard.id && dashboard.id !== 'default-overview' && !dashboard.prebuiltId;

  const handleClick = () => {
    openModal(props => (
      <DashboardRevisionsModal
        {...props}
        dashboardId={dashboard.id}
        orgSlug={organization.slug}
      />
    ));
  };

  if (!isValidDashboard) {
    return null;
  }

  return (
    <Tooltip title={t('Dashboard Revisions')}>
      <Button
        size="sm"
        icon={<IconClock />}
        aria-label={t('Dashboard Revisions')}
        onClick={handleClick}
      />
    </Tooltip>
  );
}

function DashboardRevisionsModal({
  Header,
  Body,
  dashboardId,
}: ModalRenderProps & {
  dashboardId: string;
  orgSlug: string;
}) {
  const {data: revisions, isPending} = useDashboardRevisions({dashboardId});

  return (
    <Fragment>
      <Header closeButton>{t('Dashboard Revisions')}</Header>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : revisions?.length ? (
          <RevisionList revisions={revisions} />
        ) : (
          <Flex align="center" justify="center" padding="xl">
            <Text variant="muted">{t('No revisions found.')}</Text>
          </Flex>
        )}
      </Body>
    </Fragment>
  );
}

function RevisionList({revisions}: {revisions: DashboardRevision[]}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t('Title')}</Th>
          <Th>{t('Created By')}</Th>
          <Th>{t('Created At')}</Th>
        </tr>
      </thead>
      <tbody>
        {revisions.map(revision => (
          <tr key={revision.id}>
            <Td>
              <Text size="sm">{revision.title}</Text>
            </Td>
            <Td>
              <Text size="sm" variant="muted">
                {revision.createdBy
                  ? revision.createdBy.name || revision.createdBy.email
                  : t('Unknown')}
              </Text>
            </Td>
            <Td>
              <TimeSince date={revision.dateCreated} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

const Table = styled('table')`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled('th')`
  text-align: left;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const Td = styled('td')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  vertical-align: middle;
`;
