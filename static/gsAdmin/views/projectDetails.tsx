import moment from 'moment-timezone';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ExternalLink, Link} from 'sentry/components/core/link';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ConfigStore from 'sentry/stores/configStore';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import {CustomerStats} from 'admin/components/customers/customerStats';
import type {DataType} from 'admin/components/customers/customerStatsFilters';
import {CustomerStatsFilters} from 'admin/components/customers/customerStatsFilters';
import DetailLabel from 'admin/components/detailLabel';
import DetailList from 'admin/components/detailList';
import DetailsContainer from 'admin/components/detailsContainer';
import DetailsPage from 'admin/components/detailsPage';
import EventUsers from 'admin/components/eventUsers';
import {getLogQuery} from 'admin/utils';

import {DynamicSamplingPanel} from './dynamicSamplingPanel';

function ProjectDetails() {
  const {projectId, orgId} = useParams<{
    orgId: string;
    projectId: string;
  }>();
  const {data, isPending, isError} = useApiQuery<Project>(
    [`/projects/${orgId}/${projectId}/`],
    {staleTime: Infinity}
  );
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();

  const handleRemoveEmail = (userHash: string) => {
    const endpoint = `/projects/${orgId}/${projectId}/users/${userHash}/`;

    api.request(endpoint, {
      method: 'DELETE',
      success: () => {
        addSuccessMessage('User email has been removed.');
      },
      error: () => {
        addErrorMessage('Failed to remove email.');
      },
    });
  };

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return <LoadingError />;
  }

  const activeDataType = (): DataType => {
    return (location.query.dataType as DataType) ?? 'error';
  };

  const handleStatsTypeChange = (dataType: DataType) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, dataType},
    });
  };

  const organization = data.organization;
  let orgUrl = `/organizations/${organization.slug}/`;
  let projectUrl = `/organizations/${organization.slug}/projects/${data.slug}/`;

  const configFeatures = ConfigStore.get('features');
  if (configFeatures.has('system:multi-region')) {
    orgUrl = organization.links.organizationUrl;
    projectUrl = `${orgUrl}/projects/${data.slug}/`;
  }

  const overview = (
    <DetailsContainer>
      <DetailList>
        <DetailLabel title={'Customer'}>
          {organization.name}
          {' ('}
          <Link to={`/_admin/customers/${organization.slug}/`}>{'Admin'}</Link>
          {' | '}
          <Link to={orgUrl}>{'Sentry'}</Link>
          {')'}
        </DetailLabel>
        <DetailLabel title={'Short name'}>
          <ExternalLink href={projectUrl}>{data.slug}</ExternalLink>
        </DetailLabel>
        <DetailLabel title={'Internal ID'}>{data.id}</DetailLabel>
        <DetailLabel title={'Status'}>{(data as any).status}</DetailLabel>
        <DetailLabel title={'Created'}>{moment(data.dateCreated).fromNow()}</DetailLabel>
        <DetailLabel title={'Logs'}>
          <ExternalLink
            href={getLogQuery('project', {
              organizationId: orgId,
              projectId: data.slug,
            })}
          >
            {'Project'}
          </ExternalLink>
          ,{' '}
          <ExternalLink
            href={getLogQuery('organization', {
              organizationId: orgId,
              projectId: data.slug,
            })}
          >
            {'Organization'}
          </ExternalLink>
          ,{' '}
          <ExternalLink
            href={getLogQuery('audit', {
              organizationId: orgId,
              projectId: data.slug,
            })}
          >
            {'Audit'}
          </ExternalLink>
        </DetailLabel>
      </DetailList>
      <DetailList>
        <DetailLabel title={'Features'}>
          <List>
            {data.features.map(item => (
              <ListItem key={item}>{item}</ListItem>
            ))}
          </List>
        </DetailLabel>
      </DetailList>
    </DetailsContainer>
  );

  const eventUsers = (
    <EventUsers orgId={orgId} projectId={projectId} onRemoveEmail={handleRemoveEmail} />
  );

  return (
    <div>
      <DetailsPage
        rootName={'Projects'}
        name={`${data.slug} (${organization.name})`}
        sections={[
          {
            content: overview,
          },
          {
            noPanel: true,
            content: (
              <CustomerStatsFilters
                dataType={activeDataType()}
                onChange={handleStatsTypeChange}
                organization={organization}
              />
            ),
          },
          {
            name: 'Usage Stats',
            content: (
              <CustomerStats
                dataType={activeDataType()}
                orgSlug={orgId}
                projectId={data.id}
              />
            ),
          },
          {
            noPanel: true,
            content: eventUsers,
          },
          {
            noPanel: true,
            content: (
              <DynamicSamplingPanel projectId={data.id} organization={organization} />
            ),
          },
        ]}
      />
    </div>
  );
}

export default ProjectDetails;
