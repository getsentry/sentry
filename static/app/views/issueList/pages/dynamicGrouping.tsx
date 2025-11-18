import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {NumberInput} from 'sentry/components/core/input/numberInput';
import {Link} from 'sentry/components/core/link';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import Placeholder from 'sentry/components/placeholder';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const STORAGE_KEY = 'dynamic-grouping-cluster-data';

interface AssignedEntity {
  email: string | null;
  id: string;
  name: string;
  type: string;
}

interface ClusterSummary {
  assignedTo: AssignedEntity[];
  cluster_avg_similarity: number | null;
  cluster_id: number;
  cluster_min_similarity: number | null;
  cluster_size: number | null;
  description: string;
  fixability_score: number | null;
  group_ids: number[];
  issue_titles: string[];
  project_ids: number[];
  tags: string[];
  title: string;
}

// Fetch and display actual issues from the group_ids
function ClusterIssues({groupIds}: {groupIds: number[]}) {
  const organization = useOrganization();

  // Only fetch first 3 issues for preview
  const previewGroupIds = groupIds.slice(0, 3);

  const {data: groups, isPending} = useApiQuery<Group[]>(
    [
      `/organizations/${organization.slug}/issues/`,
      {
        query: {
          group: previewGroupIds,
          query: `issue.id:[${previewGroupIds.join(',')}]`,
        },
      },
    ],
    {
      staleTime: 60000, // Cache for 1 minute
    }
  );

  if (isPending) {
    return (
      <IssuePreviewList>
        {[0, 1, 2].map(i => (
          <Placeholder key={i} height="60px" />
        ))}
      </IssuePreviewList>
    );
  }

  if (!groups || groups.length === 0) {
    return null;
  }

  return (
    <IssuePreviewList>
      {groups.map(group => (
        <IssuePreviewContainer
          key={group.id}
          to={`/organizations/${organization.slug}/issues/${group.id}/`}
        >
          <IssuePreviewContent>
            <EventOrGroupHeader data={group} source="dynamic-grouping" />
            <EventOrGroupExtraDetails data={group} showLifetime={false} />
          </IssuePreviewContent>
        </IssuePreviewContainer>
      ))}
    </IssuePreviewList>
  );
}

// Individual cluster card
function ClusterCard({cluster}: {cluster: ClusterSummary}) {
  const organization = useOrganization();

  return (
    <CardContainer>
      <CardHeader>
        <ClusterTitle as="h3" size="md">
          {cluster.title}
          {cluster.fixability_score !== null && (
            <FixabilityText size="sm" variant="muted">
              {t('%s%% fixable', Math.round(cluster.fixability_score * 100))}
            </FixabilityText>
          )}
        </ClusterTitle>
        <IssueCount>
          <CountNumber>{cluster.cluster_size ?? cluster.group_ids.length}</CountNumber>
          <CountLabel size="xs" variant="muted">
            {tn('issue', 'issues', cluster.cluster_size ?? cluster.group_ids.length)}
          </CountLabel>
        </IssueCount>
      </CardHeader>

      <CardBody>
        <Description>
          <Text>{cluster.description}</Text>
        </Description>

        <ClusterIssues groupIds={cluster.group_ids} />

        {cluster.group_ids.length > 3 && (
          <MoreIssuesText size="sm" variant="muted">
            {t('+ %s more similar issues', cluster.group_ids.length - 3)}
          </MoreIssuesText>
        )}
      </CardBody>

      <CardFooter>
        <TagsContainer>
          {cluster.tags.slice(0, 5).map(tag => (
            <Tag key={tag}>
              <Text size="xs">{tag}</Text>
            </Tag>
          ))}
          {cluster.tags.length > 5 && (
            <Tag>
              <Text size="xs">+{cluster.tags.length - 5}</Text>
            </Tag>
          )}
        </TagsContainer>
        <Link
          to={`/organizations/${organization.slug}/issues/?query=issue.id:[${cluster.group_ids.join(',')}]`}
        >
          <Button size="sm">{t('View All Issues')}</Button>
        </Link>
      </CardFooter>
    </CardContainer>
  );
}

function DynamicGrouping() {
  const organization = useOrganization();
  const [minClusterSize, setMinClusterSize] = useState(1);
  const [jsonInput, setJsonInput] = useState('');
  const [clusterData, setClusterData] = useState<ClusterSummary[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setClusterData(parsed);
        setJsonInput(stored);
        setShowInput(false);
      } catch {
        // If stored data is invalid, clear it
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleJsonSubmit = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        setParseError(t('JSON must be an array of cluster summaries'));
        return;
      }
      setClusterData(parsed);
      setParseError(null);
      setShowInput(false);
      localStorage.setItem(STORAGE_KEY, jsonInput);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : t('Invalid JSON format'));
    }
  };

  const handleClear = () => {
    setClusterData([]);
    setJsonInput('');
    setParseError(null);
    setShowInput(true);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Filter and sort clusters by fixability score (descending)
  const filteredAndSortedClusters = useMemo(() => {
    return [...clusterData]
      .filter(
        (cluster: ClusterSummary) =>
          (cluster.cluster_size ?? cluster.group_ids.length) >= minClusterSize
      )
      .sort(
        (a: ClusterSummary, b: ClusterSummary) =>
          (b.fixability_score ?? 0) - (a.fixability_score ?? 0)
      );
  }, [clusterData, minClusterSize]);

  const totalIssues = useMemo(() => {
    return filteredAndSortedClusters.reduce(
      (sum: number, c: ClusterSummary) => sum + (c.cluster_size ?? c.group_ids.length),
      0
    );
  }, [filteredAndSortedClusters]);

  return (
    <PageContainer>
      <Breadcrumbs
        crumbs={[
          {
            label: t('Issues'),
            to: `/organizations/${organization.slug}/issues/`,
          },
          {
            label: t('Dynamic Grouping'),
          },
        ]}
      />

      <PageHeader>
        <HeaderContent>
          <HeaderText>
            <Heading as="h1">{t('Dynamic Grouping')}</Heading>
            <Subheading variant="muted">
              {t('AI-powered clustering of related issues across your organization.')}
            </Subheading>
          </HeaderText>
          {clusterData.length > 0 && !showInput && (
            <HeaderActions gap="sm">
              <Button size="sm" onClick={() => setShowInput(true)}>
                {t('Update Data')}
              </Button>
              <Button size="sm" priority="danger" onClick={handleClear}>
                {t('Clear')}
              </Button>
            </HeaderActions>
          )}
        </HeaderContent>
      </PageHeader>

      {showInput || clusterData.length === 0 ? (
        <InputSection>
          <Flex direction="column" gap="md">
            <Text size="sm" variant="muted">
              {t('Paste cluster summaries JSON data below:')}
            </Text>
            <JsonTextarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              placeholder={t('Paste JSON array here...')}
              rows={10}
            />
            {parseError && <Alert type="error">{parseError}</Alert>}
            <Flex gap="sm">
              <Button priority="primary" onClick={handleJsonSubmit}>
                {t('Load Data')}
              </Button>
              {clusterData.length > 0 && (
                <Button onClick={() => setShowInput(false)}>{t('Cancel')}</Button>
              )}
            </Flex>
          </Flex>
        </InputSection>
      ) : (
        <Fragment>
          <FilterBar gap="md" align="center" justify="between">
            <FilterControls gap="sm" align="center">
              <Text size="sm" variant="muted">
                {t('Minimum issues per cluster:')}
              </Text>
              <NumberInput
                min={1}
                value={minClusterSize}
                onChange={value => setMinClusterSize(value ?? 1)}
                aria-label={t('Minimum issues per cluster')}
                size="sm"
              />
            </FilterControls>
            <ResultsSummary size="sm" variant="muted">
              {tn(
                'Viewing %s issue in %s cluster',
                'Viewing %s issues across %s clusters',
                totalIssues,
                filteredAndSortedClusters.length
              )}
            </ResultsSummary>
          </FilterBar>

          <CardsGrid>
            {filteredAndSortedClusters.map((cluster: ClusterSummary) => (
              <ClusterCard key={cluster.cluster_id} cluster={cluster} />
            ))}
          </CardsGrid>
        </Fragment>
      )}
    </PageContainer>
  );
}

// Styled Components
const PageContainer = styled('div')`
  padding: ${space(3)} ${space(4)};
  max-width: 1600px;
  margin: 0 auto;
`;

const PageHeader = styled('div')`
  margin-bottom: ${space(4)};
`;

const HeaderContent = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(2)};
`;

const HeaderText = styled('div')`
  flex: 1;
`;

const HeaderActions = styled(Flex)`
  flex-shrink: 0;
`;

const Subheading = styled(Text)`
  margin-top: ${space(1)};
  font-size: 15px;
  line-height: 1.5;
`;

const CardsGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
  gap: ${space(3)};
`;

const CardContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const CardHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  padding-bottom: ${space(2)};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const ClusterTitle = styled(Heading)`
  flex: 1;
  line-height: 1.3;
  color: ${p => p.theme.headingColor};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const FixabilityText = styled(Text)`
  font-weight: normal;
`;

const IssueCount = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  min-width: 60px;
  flex-shrink: 0;
`;

const CountNumber = styled('div')`
  font-size: 24px;
  font-weight: 600;
  color: ${p => p.theme.purple400};
  line-height: 1;
`;

const CountLabel = styled(Text)`
  margin-top: ${space(0.25)};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
`;

const CardBody = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Description = styled('div')`
  line-height: 1.6;
  color: ${p => p.theme.subText};
  margin-bottom: ${space(2)};
`;

const IssuePreviewList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const IssuePreviewContainer = styled(Link)`
  display: block;
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${p => p.theme.purple300};
    background: ${p => p.theme.backgroundElevated};
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transform: translateX(2px);
  }
`;

const IssuePreviewContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const MoreIssuesText = styled(Text)`
  margin-top: ${space(1)};
  font-style: italic;
  text-align: center;
`;

const CardFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${space(2)};
  padding-top: ${space(2)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const TagsContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
  flex: 1;
`;

const Tag = styled('div')`
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.gray100};
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.gray400};
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const FilterBar = styled(Flex)`
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(3)};
`;

const FilterControls = styled(Flex)`
  flex-shrink: 0;
`;

const ResultsSummary = styled(Text)`
  white-space: nowrap;
`;

const InputSection = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(3)};
  margin-bottom: ${space(3)};
`;

const JsonTextarea = styled('textarea')`
  width: 100%;
  min-height: 300px;
  padding: ${space(1.5)};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  resize: vertical;

  &:focus {
    outline: none;
    border-color: ${p => p.theme.purple300};
    box-shadow: 0 0 0 1px ${p => p.theme.purple300};
  }

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

export default DynamicGrouping;
