import {Fragment, useEffect} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useAuthOrganization} from 'sentry/views/authV2/authLogin/hooks/useAuthOrganization';
import {getOrganizationSsoLoginUrl} from 'sentry/views/authV2/authLogin/utils';

import {OrganizationAuth} from './organizationAuth';

type Props = Pick<ModalRenderProps, 'Body' | 'Footer' | 'Header' | 'closeModal'> & {
  onUnmount: () => void;
  organizationSlug: string;
};

export function OrganizationSsoModal({
  Body,
  Footer,
  Header,
  closeModal,
  onUnmount,
  organizationSlug,
}: Props) {
  const {data, isPending, isError, refetch} = useAuthOrganization(organizationSlug);

  useEffect(() => onUnmount, [onUnmount]);

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{t('Authenticate With SSO')}</Heading>
      </Header>
      <Body>
        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <LoadingError
            message={t('Could not load organization authentication. Try again.')}
            onRetry={refetch}
          />
        ) : data ? (
          <Stack gap="lg">
            <Text as="p">
              {t('Authenticate with this organization to continue in Sentry.')}
            </Text>
            <OrganizationAuth
              authOrganization={data}
              hideClearButton
              ssoFormAction={getOrganizationSsoLoginUrl(organizationSlug)}
            />
          </Stack>
        ) : null}
      </Body>
      <Footer>
        <Button onClick={closeModal}>{t('Cancel')}</Button>
      </Footer>
    </Fragment>
  );
}
