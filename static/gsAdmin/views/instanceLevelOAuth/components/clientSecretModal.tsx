import {Fragment} from 'react';

import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';

interface ClientDetails {
  clientID: string;
  clientSecret: string;
}

export function ClientSecretModal({
  Body,
  Footer,
  Header,
  clientSecret,
  clientID,
}: ModalRenderProps & ClientDetails) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">Client Secret Details (ONE-TIME ONLY)</Heading>
      </Header>
      <Body>
        <Stack gap="lg">
          <Text as="p">
            Your client secret is <Text bold>{clientSecret}</Text>
          </Text>
          <Text as="p">
            Make sure you save this now! You will not be able to see it again later.
          </Text>
        </Stack>
      </Body>
      <Footer>
        <LinkButton variant="danger" to={`/_admin/instance-level-oauth/${clientID}/`}>
          I understand, take me to the rest of my client details.
        </LinkButton>
      </Footer>
    </Fragment>
  );
}
