import {useParams} from 'react-router-dom';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useGetFlowByIdTemp} from 'sentry/views/codecov/flows/hooks/useGetFlowById';

export default function FlowDetail() {
  const {flowId} = useParams<{flowId: string}>();
  const {flow, isLoading: isFlowLoading} = useGetFlowByIdTemp(flowId ?? '');

  if (isFlowLoading) {
    return <LoadingIndicator />;
  }

  if (!flow) {
    return (
      <EmptyStateWarning>{t('The requested flow could not be found.')}</EmptyStateWarning>
    );
  }

  return (
    <div style={{padding: '20px'}}>
      <div style={{marginBottom: '24px'}}>
        <Breadcrumbs
          crumbs={[
            {
              label: t('Flows'),
              to: '/codecov/flows/',
            },
            {
              label: flow.name,
            },
          ]}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <h1 style={{margin: 0, fontSize: '28px', fontWeight: 600}}>{flow.name}</h1>
        </div>
        <p style={{color: '#6b7280', margin: 0}}>
          {t('Created by')}{' '}
          {flow.createdBy?.name || flow.createdBy?.email || t('Unknown')}
        </p>
      </div>

      <LayoutContainer>
        <div style={{flex: 1, minWidth: 320, maxWidth: 400}}>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '10px',
            }}
          >
            {t('Flow Details')}
          </div>
          <FlowInfoCard>
            <FlowInfoRow>
              <FlowInfoLabel>{t('Status')}</FlowInfoLabel>
              <FlowInfoValue>
                <StatusBadge status={flow.status}>{flow.status}</StatusBadge>
              </FlowInfoValue>
            </FlowInfoRow>
            <FlowInfoRow>
              <FlowInfoLabel>{t('Created')}</FlowInfoLabel>
              <FlowInfoValue>
                {flow.createdAt
                  ? new Date(flow.createdAt).toLocaleDateString()
                  : t('Unknown')}
              </FlowInfoValue>
            </FlowInfoRow>
            <FlowInfoRow>
              <FlowInfoLabel>{t('Last Seen')}</FlowInfoLabel>
              <FlowInfoValue>
                {flow.lastSeen
                  ? new Date(flow.lastSeen).toLocaleDateString()
                  : t('Unknown')}
              </FlowInfoValue>
            </FlowInfoRow>
            <FlowInfoRow>
              <FlowInfoLabel>{t('Failures')}</FlowInfoLabel>
            </FlowInfoRow>
          </FlowInfoCard>
          {flow.metadata && (
            <FlowInfoCard>
              <div style={{fontWeight: 'bold', marginBottom: '12px'}}>
                {t('Flow Configuration')}
              </div>
              <BreadcrumbInfo>
                <div style={{fontWeight: 500, marginBottom: '8px'}}>
                  {t('Start Point')}
                </div>
                <div style={{color: '#6b7280', fontSize: '14px'}}>
                  {flow.metadata.startBreadcrumb || t('Not set')}
                </div>
              </BreadcrumbInfo>
              <BreadcrumbInfo>
                <div style={{fontWeight: 500, marginBottom: '8px'}}>{t('End Point')}</div>
                <div style={{color: '#6b7280', fontSize: '14px'}}>
                  {flow.metadata.endBreadcrumb || t('Not set')}
                </div>
              </BreadcrumbInfo>
            </FlowInfoCard>
          )}
        </div>
        <div style={{flex: 2, minWidth: 0}}>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '10px',
            }}
          >
            {t('Flow Instances')}
          </div>
          <InstancesCard>
            {/* Placeholder for flow instances list */}
            {t('Flow instances will appear here.')}
          </InstancesCard>
        </div>
      </LayoutContainer>
    </div>
  );
}

const StatusBadge = styled('span')<{status: string}>`
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  background-color: ${props => (props.status === 'Active' ? '#ecfdf5' : '#fef2f2')};
  color: ${props => (props.status === 'Active' ? '#065f46' : '#991b1b')};
`;

const LayoutContainer = styled('div')`
  display: flex;
  gap: 24px;
  min-height: 60vh;
`;

const FlowInfoCard = styled('div')`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;

const FlowInfoRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
`;

const FlowInfoLabel = styled('span')`
  font-weight: 500;
  color: #374151;
`;

const FlowInfoValue = styled('span')`
  color: #6b7280;
`;

const BreadcrumbInfo = styled('div')`
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
`;

const InstancesCard = styled('div')`
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
`;
