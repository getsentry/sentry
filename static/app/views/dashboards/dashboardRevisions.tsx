import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
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

  const hasFeatureFlag = organization.features.includes('dashboards-revisions');
  const isValidDashboard =
    !!dashboard.id && dashboard.id !== 'default-overview' && !dashboard.prebuiltId;

  const handleClick = () => {
    openModal(props => <DashboardRevisionsModal {...props} dashboardId={dashboard.id} />);
  };

  if (!hasFeatureFlag || !isValidDashboard) {
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
}) {
  const {data: revisions, isPending, isError} = useDashboardRevisions({dashboardId});

  return (
    <Fragment>
      <Header closeButton>{t('Dashboard Revisions')}</Header>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <Alert variant="danger">{t('Failed to load dashboard revisions.')}</Alert>
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
          <Th>
            <Text size="sm" variant="muted" bold as="span">
              {t('Title')}
            </Text>
          </Th>
          <Th>
            <Text size="sm" variant="muted" bold as="span">
              {t('Created By')}
            </Text>
          </Th>
          <Th>
            <Text size="sm" variant="muted" bold as="span">
              {t('Created At')}
            </Text>
          </Th>
        </tr>
      </thead>
      <tbody>
        {revisions.map(revision => (
          <tr key={revision.id}>
            <Td>
              <Flex align="center" gap="sm">
                <Text size="sm">{revision.title}</Text>
                {revision.source === 'pre-restore' && (
                  <Tag variant="muted">{t('pre-restore')}</Tag>
                )}
              </Flex>
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
`;

const Td = styled('td')`
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  vertical-align: middle;
`;
