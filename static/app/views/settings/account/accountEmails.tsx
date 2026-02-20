import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {AlertLink} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, FormSearch, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Grid} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {RequestOptions} from 'sentry/api';
import Confirm from 'sentry/components/confirm';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete, IconStack} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {UserEmail} from 'sentry/types/user';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchMutation, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

const ENDPOINT = getApiUrl('/users/$userId/emails/', {path: {userId: 'me'}});

const schema = z.object({
  email: z.string().email(t('Enter a valid email address')),
});

function AccountEmails() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      fetchMutation<{detail?: string}>({
        url: ENDPOINT,
        method: 'POST',
        data,
      }),
    onSuccess: response => {
      queryClient.invalidateQueries({queryKey: makeEmailsEndpointKey()});
      if (response?.detail) {
        addSuccessMessage(response.detail);
      }
    },
    onError: error => {
      if (error instanceof RequestError) {
        const errorMessage = error.responseJSON?.detail;
        if (typeof errorMessage === 'string') {
          addErrorMessage(errorMessage);
        } else {
          addErrorMessage(errorMessage?.message ?? t('An unknown error occurred.'));
        }
      }
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {email: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value, formApi}) => {
      return mutation
        .mutateAsync(value)
        .then(() => {
          formApi.reset();
        })
        .catch(() => {});
    },
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Emails')} />
      <SettingsPageHeader title={t('Email Addresses')} />
      <EmailAddresses />
      <FormSearch route="/settings/account/emails/">
        <form.AppForm>
          <form.FormWrapper>
            <form.FieldGroup title={t('Add Secondary Emails')}>
              <form.AppField name="email">
                {field => (
                  <field.Layout.Row
                    label={t('Additional Email')}
                    hintText={t('Designate an alternative email for this account')}
                  >
                    <field.Input
                      type="email"
                      value={field.state.value}
                      onChange={field.handleChange}
                      placeholder={t('e.g. secondary@example.com')}
                    />
                  </field.Layout.Row>
                )}
              </form.AppField>
            </form.FieldGroup>
            <Flex justify="end">
              <form.SubmitButton>{t('Add email')}</form.SubmitButton>
            </Flex>
          </form.FormWrapper>
        </form.AppForm>
      </FormSearch>

      <AlertLink.Container>
        <AlertLink
          to="/settings/account/notifications"
          trailingItems={<IconStack />}
          variant="info"
        >
          {t('Want to change how many emails you get? Use the notifications panel.')}
        </AlertLink>
      </AlertLink.Container>
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
    isPending,
    isError,
    refetch,
  } = useApiQuery<UserEmail[]>(makeEmailsEndpointKey(), {staleTime: 0, gcTime: 0});

  if (isPending || isUpdating) {
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
        {!isVerified && <Tag variant="warning">{t('Unverified')}</Tag>}
        {isPrimary && <Tag variant="success">{t('Primary')}</Tag>}
      </EmailTags>
      <Grid flow="column" align="center" gap="md">
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
          <Confirm
            onConfirm={() => onRemove(email)}
            priority="danger"
            message={tct('Are you sure you want to remove [email]?', {
              email: <strong>{email}</strong>,
            })}
          >
            <Button
              aria-label={t('Remove email')}
              data-test-id="remove"
              priority="danger"
              size="sm"
              icon={<IconDelete />}
            />
          </Confirm>
        )}
      </Grid>
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
