import styled from '@emotion/styled';
import {IconDelete} from '@sentry/icons/delete';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {toast} from '@sentry/scraps/toast';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {ApiApplication} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useApi} from 'sentry/utils/useApi';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

type Authorization = {
  application: ApiApplication;
  homepageUrl: string;
  id: string;
  organization: Organization | null;
  scopes: string[];
};

const authorizationsOptions = apiOptions.as<Authorization[]>()('/api-authorizations/', {
  staleTime: 0,
});

function AccountAuthorizations() {
  const api = useApi();
  const queryClient = useQueryClient();

  const {data, isPending, isError, refetch} = useQuery(authorizationsOptions);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleRevoke = async (authorization: Authorization) => {
    const oldData = data;
    queryClient.setQueryData(authorizationsOptions.queryKey, response =>
      response?.json
        ? {...response, json: response.json.filter(a => a.id !== authorization.id)}
        : response
    );
    try {
      await api.requestPromise('/api-authorizations/', {
        method: 'DELETE',
        data: {authorization: authorization.id},
      });
      toast.success(t('Saved changes'));
    } catch (_err) {
      queryClient.setQueryData(authorizationsOptions.queryKey, response => ({
        ...response,
        headers: response?.headers ?? {},
        json: oldData,
      }));
      toast.error(t('Unable to save changes, please try again'));
    }
  };

  const isEmpty = data.length === 0;
  return (
    <SentryDocumentTitle title={t('Approved Applications')}>
      <SettingsPageHeader
        title="Authorized Applications"
        subtitle={tct(
          'You can manage your own applications via the [link:API dashboard].',
          {
            link: <Link to="/settings/account/api/" />,
          }
        )}
      />

      <Panel>
        <PanelHeader>{t('Approved Applications')}</PanelHeader>

        <PanelBody>
          {isEmpty && (
            <EmptyMessage>
              {t("You haven't approved any third party applications.")}
            </EmptyMessage>
          )}

          {!isEmpty && (
            <div>
              {data.map(authorization => (
                <PanelItemCenter key={authorization.id}>
                  <Stack flex="1">
                    <ApplicationName>{authorization.application.name}</ApplicationName>
                    {authorization.homepageUrl && (
                      <Url>
                        <ExternalLink href={authorization.homepageUrl}>
                          {authorization.homepageUrl}
                        </ExternalLink>
                      </Url>
                    )}
                    <DetailRow>{authorization.scopes.join(', ')}</DetailRow>
                    {authorization.organization && (
                      <DetailRow>
                        {t('scopes are limited to ')}
                        {authorization.organization.slug}
                      </DetailRow>
                    )}
                  </Stack>
                  <Button
                    size="sm"
                    onClick={() => handleRevoke(authorization)}
                    icon={<IconDelete />}
                    aria-label={t('Delete')}
                    data-test-id={authorization.id}
                  />
                </PanelItemCenter>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </SentryDocumentTitle>
  );
}

export default AccountAuthorizations;

const PanelItemCenter = styled(PanelItem)`
  align-items: center;
`;

const ApplicationName = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.xs};
`;

/**
 * Intentionally wrap <a> so that it does not take up full width and cause
 * hit box issues
 */
const Url = styled('div')`
  margin-bottom: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.sm};
`;

const DetailRow = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;
