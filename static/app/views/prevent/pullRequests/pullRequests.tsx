import {useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import PullRequestItem from './pullRequestItem';
import type {PullRequest} from './types';

interface PullRequestsResponse {
  meta: {
    limit_per_repo: number;
    repository_count: number;
    state: string;
    total_prs: number;
  };
  pull_requests: PullRequest[];
}

function PullRequests() {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  // Get initial values from URL query params
  const initialState = decodeScalar(location.query.state, 'open') as
    | 'open'
    | 'closed'
    | 'all';
  const initialRepo = decodeScalar(location.query.repo, 'all');

  const [selectedState, setSelectedState] = useState<'open' | 'closed' | 'all'>(
    initialState
  );
  const [selectedRepo, setSelectedRepo] = useState<string>(initialRepo);

  const {data, error, isLoading} = useApiQuery<PullRequestsResponse>(
    [
      `/organizations/${organization.slug}/pull-requests/`,
      {
        query: {
          state: selectedState,
          limit: '50',
          ...(selectedRepo !== 'all' && {repo: selectedRepo}),
        },
      },
    ],
    {
      staleTime: 30000, // 30 seconds
    }
  );

  // Also fetch all repos data to ensure dropdown is always populated
  const {data: allReposData} = useApiQuery<PullRequestsResponse>(
    [
      `/organizations/${organization.slug}/pull-requests/`,
      {
        query: {
          state: 'all',
          limit: '100',
        },
      },
    ],
    {
      staleTime: 300000, // Cache for 5 minutes since repo list changes infrequently
      enabled: !data || (data.pull_requests && data.pull_requests.length === 0), // Only fetch if main data is empty or not loaded
    }
  );

  // Get repositories from current data first, fallback to all repos data
  const repositories = data?.pull_requests?.length
    ? Array.from(
        new Set([
          ...data.pull_requests.map(pr => pr.repository.full_name),
          ...(allReposData?.pull_requests?.map(pr => pr.repository.full_name) || []),
        ])
      )
    : allReposData?.pull_requests
      ? Array.from(new Set(allReposData.pull_requests.map(pr => pr.repository.full_name)))
      : [];

  // If we have a selected repo but it's not in the current repositories list, add it
  const finalRepositories =
    selectedRepo !== 'all' && !repositories.includes(selectedRepo)
      ? [...repositories, selectedRepo]
      : repositories;

  if (error) {
    return (
      <div style={{padding: space(2), color: 'red'}}>
        {error.responseJSON?.detail || t('Failed to load pull requests')}
      </div>
    );
  }

  return (
    <div style={{padding: '24px'}}>
      <HeaderSection>
        <HeaderTitle>
          <IconGithub size="lg" />
          {t('Pull Requests')}
        </HeaderTitle>
        <HeaderActions>
          <CompactSelect
            value={selectedRepo}
            onChange={opt => {
              setSelectedRepo(opt.value);
              const query = {...location.query};
              if (opt.value === 'all') {
                delete query.repo;
              } else {
                query.repo = opt.value;
              }
              navigate({
                pathname: location.pathname,
                query,
              });
            }}
            options={[
              {value: 'all', label: t('All repositories')},
              ...finalRepositories.map(repo => ({
                value: repo,
                label: repo,
              })),
            ]}
            size="sm"
          />
          <SegmentedControl<'open' | 'closed' | 'all'>
            value={selectedState}
            onChange={value => {
              setSelectedState(value);
              navigate({
                pathname: location.pathname,
                query: {
                  ...location.query,
                  state: value,
                },
              });
            }}
            aria-label={t('PR State Filter')}
          >
            <SegmentedControl.Item key="open" textValue="open">
              {t('Open')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="closed" textValue="closed">
              {t('Closed')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="all" textValue="all">
              {t('All')}
            </SegmentedControl.Item>
          </SegmentedControl>
        </HeaderActions>
      </HeaderSection>

      <Panel>
        <PanelHeader>
          <div>{t('Pull Requests')}</div>
        </PanelHeader>

        <PanelBody>
          {isLoading ? (
            <LoadingContainer>
              <LoadingIndicator />
            </LoadingContainer>
          ) : data?.pull_requests?.length === 0 ? (
            <EmptyState>
              <IconGithub size="xxl" color="gray300" />
              <EmptyTitle>
                {selectedState === 'open'
                  ? t('No open pull requests found')
                  : selectedState === 'closed'
                    ? t('No closed pull requests found')
                    : t('No pull requests found')}
              </EmptyTitle>
              <EmptyDescription>
                {t(
                  'Make sure your GitHub integration is configured and repositories are connected.'
                )}
              </EmptyDescription>
            </EmptyState>
          ) : (
            <PullRequestsList>
              {data?.pull_requests
                ?.filter(
                  pr => selectedRepo === 'all' || pr.repository.full_name === selectedRepo
                )
                .map(pr => (
                  <PullRequestItem
                    key={`${pr.repository.full_name}-${pr.number}`}
                    pullRequest={pr}
                  />
                ))}
            </PullRequestsList>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}

const HeaderSection = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(2)};
`;

const HeaderTitle = styled('h1')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin: 0;
  font-size: 24px;
  font-weight: 600;
`;

const HeaderActions = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

const LoadingContainer = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(4)};
`;

const EmptyState = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${space(4)};
  text-align: center;
`;

const EmptyTitle = styled('h3')`
  margin: ${space(2)} 0 ${space(1)} 0;
  color: ${p => p.theme.headingColor};
`;

const EmptyDescription = styled('p')`
  margin: 0;
  color: ${p => p.theme.subText};
  max-width: 400px;
`;

const PullRequestsList = styled('div')`
  display: flex;
  flex-direction: column;
`;

export default PullRequests;
