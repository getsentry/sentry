import {useState} from 'react';

import {AlertLink} from '@sentry/scraps/alert';
import {Button, LinkButton} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import RepositoryRow from 'sentry/components/repositoryRow';
import {IconCommit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Repository, RepositoryStatus} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type DetectedPlatform = {
  bytes: number;
  confidence: string;
  language: string;
  platform: string;
};

type DetectionState = {
  error: string | null;
  loading: boolean;
  results: DetectedPlatform[] | null;
};

function RepoWithPlatformDetection({
  repo,
  orgSlug,
  onRepositoryChange,
}: {
  onRepositoryChange: (data: {id: string; status: RepositoryStatus}) => void;
  orgSlug: string;
  repo: Repository;
}) {
  const api = useApi();
  const [state, setState] = useState<DetectionState>({
    loading: false,
    results: null,
    error: null,
  });

  const isGitHub = repo.provider?.id?.includes('github');

  async function handleDetect() {
    setState({loading: true, results: null, error: null});
    try {
      const response = await api.requestPromise(
        `/organizations/${orgSlug}/repos/${repo.id}/platforms/`
      );
      setState({loading: false, results: response.platforms, error: null});
    } catch (err) {
      const message =
        err?.responseJSON?.detail || err?.message || 'Failed to detect platforms';
      setState({loading: false, results: null, error: message});
    }
  }

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center'}}>
        <div style={{flex: 1}}>
          <RepositoryRow
            repository={repo}
            showProvider
            orgSlug={orgSlug}
            onRepositoryChange={onRepositoryChange}
          />
        </div>
        {isGitHub && (
          <div style={{padding: '0 16px', flexShrink: 0}}>
            <Button size="sm" onClick={handleDetect} disabled={state.loading}>
              {state.loading ? t('Detecting...') : t('Detect Platforms')}
            </Button>
          </div>
        )}
      </div>
      {state.loading && (
        <div style={{padding: '8px 16px'}}>
          <LoadingIndicator mini />
        </div>
      )}
      {state.error && (
        <div style={{padding: '8px 16px', color: '#bf2a2a', fontSize: '13px'}}>
          {state.error}
        </div>
      )}
      {state.results && state.results.length === 0 && (
        <div style={{padding: '8px 16px', fontSize: '13px', color: '#6c5fc7'}}>
          {t('No platforms detected for this repository.')}
        </div>
      )}
      {state.results && state.results.length > 0 && (
        <div style={{padding: '8px 16px 16px'}}>
          <table style={{width: '100%', fontSize: '13px', borderCollapse: 'collapse'}}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  borderBottom: '1px solid #e2dee6',
                  color: '#80708f',
                }}
              >
                <th style={{padding: '4px 8px'}}>{t('Platform')}</th>
                <th style={{padding: '4px 8px'}}>{t('Language')}</th>
                <th style={{padding: '4px 8px'}}>{t('Bytes')}</th>
                <th style={{padding: '4px 8px'}}>{t('Confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {state.results.map(p => (
                <tr key={p.platform} style={{borderBottom: '1px solid #f0ecf5'}}>
                  <td style={{padding: '4px 8px', fontWeight: 600}}>{p.platform}</td>
                  <td style={{padding: '4px 8px'}}>{p.language}</td>
                  <td style={{padding: '4px 8px'}}>{p.bytes.toLocaleString()}</td>
                  <td style={{padding: '4px 8px'}}>{p.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type Props = {
  itemList: Repository[];
  onRepositoryChange: (data: {id: string; status: RepositoryStatus}) => void;
  organization: Organization;
};

function OrganizationRepositories({itemList, onRepositoryChange, organization}: Props) {
  const hasItemList = itemList && itemList.length > 0;

  return (
    <div>
      <SettingsPageHeader title={t('Repositories')} />
      <AlertLink.Container>
        <AlertLink variant="info" to={`/settings/${organization.slug}/integrations/`}>
          {t(
            'Want to add a repository to start tracking commits? Install or configure your version control integration here.'
          )}
        </AlertLink>
      </AlertLink.Container>
      {!hasItemList && (
        <div className="m-b-2">
          <TextBlock>
            {t(
              "Connecting a repository allows Sentry to capture commit data via webhooks. This enables features like suggested assignees and resolving issues via commit message. Once you've connected a repository, you can associate commits with releases via the API."
            )}
            &nbsp;
            {tct('See our [link:documentation] for more details.', {
              link: <ExternalLink href="https://docs.sentry.io/learn/releases/" />,
            })}
          </TextBlock>
        </div>
      )}

      {hasItemList ? (
        <Panel>
          <PanelHeader>{t('Added Repositories')}</PanelHeader>
          <PanelBody>
            <div>
              {itemList.map(repo => (
                <RepoWithPlatformDetection
                  key={repo.id}
                  repo={repo}
                  orgSlug={organization.slug}
                  onRepositoryChange={onRepositoryChange}
                />
              ))}
            </div>
          </PanelBody>
        </Panel>
      ) : (
        <Panel>
          <EmptyMessage
            icon={<IconCommit />}
            title={t('Sentry is better with commit data')}
            action={
              <LinkButton external href="https://docs.sentry.io/learn/releases/">
                {t('Learn more')}
              </LinkButton>
            }
          >
            {t(
              'Adding one or more repositories will enable enhanced releases and the ability to resolve Sentry Issues via git message.'
            )}
          </EmptyMessage>
        </Panel>
      )}
    </div>
  );
}

export default OrganizationRepositories;
