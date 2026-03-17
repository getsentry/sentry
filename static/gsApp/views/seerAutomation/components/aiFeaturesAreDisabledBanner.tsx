import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export function AiFeaturesAreDisabledBanner() {
  const organization = useOrganization();

  const hasWriteAccess = organization.access.includes('org:write');

  const {mutate} = useMutation({
    mutationFn: () => {
      addLoadingMessage(t('Saving changes...'));
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: {hideAiFeatures: false}, // Hard-coded so we only go in the 'enable AI' direction
      });
    },
    onSuccess: updated => {
      addSuccessMessage(t('Generative AI Features enabled'));
      updateOrganization(updated);
    },
    onError: () => addErrorMessage(t('Unable to save change')),
  });

  return (
    <Container border="warning" radius="md" overflow="hidden">
      <Stack>
        <Alert system showIcon={false} variant="warning">
          {t('Generative AI Features are disabled for your organization.')}
        </Alert>
        <Flex align="center" gap="xl" padding="2xl">
          {hasWriteAccess ? (
            <Fragment>
              <Text>
                {tct(
                  'Seer is part of your plan, but you need to enable Generative AI Features in your organization in order to use it. Seer includes Autofix and Code Review. Read more about [seer:Seer] and other [ai:generative AI features] in the docs.',
                  {
                    seer: (
                      <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/" />
                    ),
                    ai: (
                      <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/#ai-powered-features" />
                    ),
                  }
                )}
              </Text>
              <Button size="sm" priority="default" onClick={() => mutate()}>
                {t('Enable Generative AI Features')}
              </Button>
            </Fragment>
          ) : (
            <Text>
              {tct(
                'Seer is part of your plan, but you need an admin to enable Generative AI Features in your organization in order to use it. Seer includes Autofix and Code Review. Read more about [seer:Seer] and other [ai:generative AI features] in the docs.',
                {
                  seer: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/" />
                  ),
                  ai: (
                    <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/#ai-powered-features" />
                  ),
                }
              )}
            </Text>
          )}
        </Flex>
      </Stack>
    </Container>
  );
}
