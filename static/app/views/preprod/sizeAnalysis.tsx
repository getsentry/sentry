import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {Radio} from 'sentry/components/core/radio';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import TreemapVisualization from './treemapVisualization';
import type {FileAnalysisReport} from './types';

function SizeAnalysis() {
  return (
    <SentryDocumentTitle title={t('Size analysis')}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Size analysis')} <FeatureBadge type="new" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <SizeAnalysisDemo />
        </Layout.Main>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}

// Component to demo size analysis data fetching
function SizeAnalysisDemo() {
  const api = useApi();
  const organization = useOrganization();
  const [sizeAnalysisData, setSizeAnalysisData] = useState<FileAnalysisReport | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleLines, setVisibleLines] = useState(50);

  // Form state
  const [projectId, setProjectId] = useState('1');
  const [artifactId, setArtifactId] = useState('2');
  const [sizeMode, setSizeMode] = useState<'install' | 'download'>('install');

  const fetchSizeAnalysisData = useCallback(async () => {
    if (!projectId || !artifactId) {
      setError('All fields are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSizeAnalysisData(null);
    setVisibleLines(50); // Reset to 50 lines when fetching new data
    try {
      const response = await api.requestPromise(
        `/projects/${organization.slug}/${projectId}/files/preprodartifacts/${artifactId}/size-analysis/`,
        {
          method: 'GET',
        }
      );
      setSizeAnalysisData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch size analysis data');
    } finally {
      setIsLoading(false);
    }
  }, [api, organization.slug, projectId, artifactId]);

  const showMoreLines = useCallback(() => {
    setVisibleLines(prev => prev + 50);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      fetchSizeAnalysisData();
    },
    [fetchSizeAnalysisData]
  );

  const jsonString = sizeAnalysisData ? JSON.stringify(sizeAnalysisData, null, 2) : '';
  const jsonLines = jsonString.split('\n');
  const truncatedJson = jsonLines.slice(0, visibleLines).join('\n');
  const hasMoreLines = visibleLines < jsonLines.length;

  return (
    <SizeAnalysisContainer>
      <h4>{t('Size Analysis Data')}</h4>

      {/* Query Form */}
      <QueryForm onSubmit={handleSubmit}>
        <FormRow>
          <FormField>
            <label htmlFor="projectId">{t('Project ID:')}</label>
            <FormInput
              id="projectId"
              type="text"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              placeholder="1"
            />
          </FormField>
          <FormField>
            <label htmlFor="artifactId">{t('Artifact ID:')}</label>
            <FormInput
              id="artifactId"
              type="text"
              value={artifactId}
              onChange={e => setArtifactId(e.target.value)}
              placeholder="2"
            />
          </FormField>
        </FormRow>
        <FormActions>
          <Button type="submit" disabled={isLoading || !projectId || !artifactId}>
            {isLoading ? t('Loading...') : t('Fetch Size Analysis')}
          </Button>
          {sizeAnalysisData && (
            <Button size="sm" onClick={fetchSizeAnalysisData} disabled={isLoading}>
              {t('Refresh')}
            </Button>
          )}
        </FormActions>
      </QueryForm>

      {error && (
        <ErrorMessage>
          <strong>{t('API Error:')}</strong> {error}
        </ErrorMessage>
      )}

      {isLoading && (
        <LoadingContainer>
          <LoadingIndicator />
          <p>{t('Fetching size analysis data...')}</p>
        </LoadingContainer>
      )}

      {sizeAnalysisData && !isLoading && (
        <SizeAnalysisContent>
          {sizeAnalysisData.treemap && (
            <div>
              <TreemapSectionHeader>
                <h5>{t('Size Analysis Treemap')}</h5>
                <SizeModeToggle>
                  <RadioLabel>
                    <Radio
                      checked={sizeMode === 'install'}
                      onChange={() => setSizeMode('install')}
                    />
                    {t('Install Size')}
                  </RadioLabel>
                  <RadioLabel>
                    <Radio
                      checked={sizeMode === 'download'}
                      onChange={() => setSizeMode('download')}
                    />
                    {t('Download Size')}
                  </RadioLabel>
                </SizeModeToggle>
              </TreemapSectionHeader>

              <TreemapVisualization data={sizeAnalysisData} sizeMode={sizeMode} />
            </div>
          )}

          {sizeAnalysisData.file_analysis && (
            <SizeAnalysisSummary>
              <h5>{t('Summary:')}</h5>
              <SummaryGrid>
                <SummaryItem>
                  <strong>{t('Total Size:')}</strong>
                  <span>
                    {(sizeAnalysisData.file_analysis.total_size / 1024 / 1024).toFixed(2)}{' '}
                    MB
                  </span>
                </SummaryItem>
                <SummaryItem>
                  <strong>{t('File Count:')}</strong>
                  <span>{sizeAnalysisData.file_analysis.file_count}</span>
                </SummaryItem>
                <SummaryItem>
                  <strong>{t('Treemap Total Size:')}</strong>
                  <span>
                    {(sizeAnalysisData.treemap.total_install_size / 1024 / 1024).toFixed(
                      2
                    )}{' '}
                    MB
                  </span>
                </SummaryItem>
                <SummaryItem>
                  <strong>{t('Treemap Files:')}</strong>
                  <span>{sizeAnalysisData.treemap.file_count}</span>
                </SummaryItem>
              </SummaryGrid>

              {sizeAnalysisData.file_analysis.files_by_type && (
                <div>
                  <h6>{t('Files by Type:')}</h6>
                  <BreakdownList>
                    {Object.entries(sizeAnalysisData.file_analysis.files_by_type).map(
                      ([type, files]: [string, any]) => (
                        <BreakdownItem key={type}>
                          <span>{type}:</span>
                          <span>{files.length} files</span>
                        </BreakdownItem>
                      )
                    )}
                  </BreakdownList>
                </div>
              )}
            </SizeAnalysisSummary>
          )}

          <JsonHeader>
            <h5>{t('Raw JSON Response:')}</h5>
            <JsonStats>
              {t('Showing lines')} {Math.min(visibleLines, jsonLines.length)} {t('of')}{' '}
              {jsonLines.length}
            </JsonStats>
          </JsonHeader>
          <CodeSnippet language="json" dark>
            {truncatedJson}
          </CodeSnippet>

          {hasMoreLines && (
            <ShowMoreContainer>
              <Button size="sm" onClick={showMoreLines}>
                {t('Show 50 more lines')}
              </Button>
            </ShowMoreContainer>
          )}
        </SizeAnalysisContent>
      )}
    </SizeAnalysisContainer>
  );
}

const SizeAnalysisContainer = styled('div')`
  background: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.border};
  border-radius: 4px;
  padding: ${space(2)};
  margin: ${space(2)};
`;

const SizeAnalysisContent = styled('div')`
  h5,
  h6 {
    margin: ${space(2)} 0 ${space(1)} 0;
    color: ${p => p.theme.headingColor};
  }
`;

const SizeAnalysisSummary = styled('div')`
  margin-top: ${space(3)};
  padding: ${space(2)};
  background: ${p => p.theme.background};
  border-radius: 4px;
`;

const SummaryGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const SummaryItem = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)};
  background: ${p => p.theme.backgroundTertiary};
  border-radius: 4px;

  strong {
    color: ${p => p.theme.headingColor};
  }
`;

const BreakdownList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const BreakdownItem = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(0.5)} ${space(1)};
  background: ${p => p.theme.backgroundTertiary};
  border-radius: 3px;
  font-size: ${p => p.theme.fontSize.sm};
`;

const ErrorMessage = styled('div')`
  color: ${p => p.theme.error};
  background: ${p => p.theme.alert.error.background};
  border: 1px solid ${p => p.theme.alert.error.border};
  padding: ${space(2)};
  border-radius: 4px;
  margin-bottom: ${space(2)};

  small {
    color: ${p => p.theme.subText};
  }
`;

const JsonHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const JsonStats = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const ShowMoreContainer = styled('div')`
  margin-top: ${space(2)};
  text-align: center;
`;

const QueryForm = styled('form')`
  display: flex;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
  align-items: flex-end;
`;

const FormRow = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const FormField = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const FormInput = styled('input')`
  padding: ${space(0.75)} ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: 4px;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.textColor};
  background-color: ${p => p.theme.background};

  &:focus {
    outline: none;
    border-color: ${p => p.theme.active};
  }
`;

const FormActions = styled('div')`
  display: flex;
  gap: ${space(1)};
`;

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${space(3)};
`;

const TreemapSectionHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(2)};
`;

const SizeModeToggle = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const RadioLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  cursor: pointer;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;

export default SizeAnalysis;
