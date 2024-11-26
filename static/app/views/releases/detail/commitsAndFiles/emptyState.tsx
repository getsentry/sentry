import {LinkButton} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {Body, Main} from 'sentry/components/layouts/thirds';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';

type Props = {
  children: React.ReactNode;
};

export function EmptyState({children}: Props) {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning>
          <p>{children}</p>
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
}

export function NoReleaseRepos() {
  return (
    <Body>
      <Main fullWidth>
        <Panel dashedBorder>
          <EmptyMessage
            icon={<IconCommit size="xl" />}
            title={t('Releases are better with commit data!')}
            description={t('No commits associated with this release have been found.')}
          />
        </Panel>
      </Main>
    </Body>
  );
}

export function NoRepositories({orgSlug}: {orgSlug: string}) {
  return (
    <Body>
      <Main fullWidth>
        <Panel dashedBorder>
          <EmptyMessage
            icon={<IconCommit size="xl" />}
            title={t('Releases are better with commit data!')}
            description={t(
              'Connect a repository to see commit info, files changed, and authors involved in future releases.'
            )}
            action={
              <LinkButton priority="primary" to={`/settings/${orgSlug}/repos/`}>
                {t('Connect a repository')}
              </LinkButton>
            }
          />
        </Panel>
      </Main>
    </Body>
  );
}
