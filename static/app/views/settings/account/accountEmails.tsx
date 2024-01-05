import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {RequestOptions} from 'sentry/api';
import AlertLink from 'sentry/components/alertLink';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Form, {FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Tag from 'sentry/components/tag';
import accountEmailsFields from 'sentry/data/forms/accountEmails';
import {IconDelete, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {UserEmail} from 'sentry/types';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ENDPOINT = '/users/me/emails/';

function AccountEmails() {
  const handleSubmitSuccess: FormProps['onSubmitSuccess'] = (_change, model, id) => {
    if (id === undefined) {
      return;
    }
    model.setValue(id, '');
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Emails')} />
      <SettingsPageHeader title={t('Email Addresses')} />
      <EmailAddresses />
      <Form
        apiMethod="POST"
        apiEndpoint={ENDPOINT}
        saveOnBlur
        allowUndo={false}
        onSubmitSuccess={handleSubmitSuccess}
      >
        <JsonForm forms={accountEmailsFields} />
      </Form>

      <AlertLink to="/settings/account/notifications" icon={<IconStack />}>
        {t('Want to change how many emails you get? Use the notifications panel.')}
      </AlertLink>
    </Fragment>
  );
}

export default AccountEmails;

function makeEmailsEndpointKey(): ApiQueryKey {
  return [ENDPOINT];
}

export function EmailAddresses() {
  const api = useApi();
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    data: emails = [],
    isLoading,
    isError,
    refetch,
  } = useApiQuery<UserEmail[]>(makeEmailsEndpointKey(), {staleTime: 0, cacheTime: 0});

  if (isLoading || isUpdating) {
    return (
      <Panel>
        <PanelHeader>{t('Email Addresses')}</PanelHeader>
        <PanelBody>
          <LoadingIndicator />
        </PanelBody>
      </Panel>
    );
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  function doApiCall(endpoint: string, requestParams: RequestOptions) {
    setIsUpdating(true);
    api
      .requestPromise(endpoint, requestParams)
      .catch(err => {
        if (err?.responseJSON?.email) {
          addErrorMessage(err.responseJSON.email);
        }
      })
      .finally(() => {
        refetch();
        setIsUpdating(false);
      });
  }

  const handleSetPrimary = (email: string) => {
    doApiCall(ENDPOINT, {
      method: 'PUT',
      data: {email},
    });
  };

  const handleRemove = (email: string) => {
    doApiCall(ENDPOINT, {
      method: 'DELETE',
      data: {email},
    });
  };

  const handleVerify = (email: string) => {
    doApiCall(`${ENDPOINT}confirm/`, {
      method: 'POST',
      data: {email},
    });
  };

  const primary = emails.find(({isPrimary}) => isPrimary);
  const secondary = emails.filter(({isPrimary}) => !isPrimary);

  return (
    <Panel>
      <PanelHeader>{t('Email Addresses')}</PanelHeader>
      <PanelBody>
        {primary && (
          <EmailRow onRemove={handleRemove} onVerify={handleVerify} {...primary} />
        )}

        {secondary.map(emailObj => (
          <EmailRow
            key={emailObj.email}
            onSetPrimary={handleSetPrimary}
            onRemove={handleRemove}
            onVerify={handleVerify}
            {...emailObj}
          />
        ))}
      </PanelBody>
    </Panel>
  );
}

type EmailRowProps = {
  email: string;
  onRemove: (email: string) => void;
  onVerify: (email: string) => void;
  hideRemove?: boolean;
  isPrimary?: boolean;
  isVerified?: boolean;
  onSetPrimary?: (email: string) => void;
};

function EmailRow({
  email,
  onRemove,
  onVerify,
  onSetPrimary,
  isVerified,
  isPrimary,
  hideRemove,
}: EmailRowProps) {
  return (
    <EmailItem>
      <EmailTags>
        {email}
        {!isVerified && <Tag type="warning">{t('Unverified')}</Tag>}
        {isPrimary && <Tag type="success">{t('Primary')}</Tag>}
      </EmailTags>
      <ButtonBar gap={1}>
        {!isPrimary && isVerified && (
          <Button size="sm" onClick={() => onSetPrimary?.(email)}>
            {t('Set as primary')}
          </Button>
        )}
        {!isVerified && (
          <Button size="sm" onClick={() => onVerify(email)}>
            {t('Resend verification')}
          </Button>
        )}
        {!hideRemove && !isPrimary && (
          <Button
            aria-label={t('Remove email')}
            data-test-id="remove"
            priority="danger"
            size="sm"
            icon={<IconDelete />}
            onClick={() => onRemove(email)}
          />
        )}
      </ButtonBar>
    </EmailItem>
  );
}

const EmailTags = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
`;

const EmailItem = styled(PanelItem)`
  justify-content: space-between;
`;
