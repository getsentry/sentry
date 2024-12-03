import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {ApiApplication} from 'sentry/types/user';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

type Authorization = {
  application: ApiApplication;
  homepageUrl: string;
  id: string;
  organization: Organization | null;
  scopes: string[];
};

function AccountAuthorizations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const ENDPOINT = '/api-authorizations/';

  const {data, isPending, isError, refetch} = useApiQuery<Authorization[]>([ENDPOINT], {
    staleTime: 0,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const handleRevoke = async (authorization: Authorization) => {
    const oldData = data;
    setApiQueryData<Authorization[]>(queryClient, [ENDPOINT], prevData =>
      prevData.filter(a => a.id !== authorization.id)
    );
    try {
      await api.requestPromise('/api-authorizations/', {
        method: 'DELETE',
        data: {authorization: authorization.id},
      });
      addSuccessMessage(t('Saved changes'));
    } catch (_err) {
      setApiQueryData<any>(queryClient, [ENDPOINT], oldData);
      addErrorMessage(t('Unable to save changes, please try again'));
    }
  };

  const isEmpty = data.length === 0;
  return (
    <SentryDocumentTitle title={t('Approved Applications')}>
      <SettingsPageHeader title="Authorized Applications" />
      <Description>
        {tct('You can manage your own applications via the [link:API dashboard].', {
          link: <Link to="/settings/account/api/" />,
        })}
      </Description>

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
                  <ApplicationDetails>
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
                        {t('scopes are limitted to ')}
                        {authorization.organization.slug}
                      </DetailRow>
                    )}
                  </ApplicationDetails>
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

const Description = styled('p')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  margin-bottom: ${space(4)};
`;

const PanelItemCenter = styled(PanelItem)`
  align-items: center;
`;

const ApplicationDetails = styled('div')`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const ApplicationName = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(0.5)};
`;

/**
 * Intentionally wrap <a> so that it does not take up full width and cause
 * hit box issues
 */
const Url = styled('div')`
  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const DetailRow = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
