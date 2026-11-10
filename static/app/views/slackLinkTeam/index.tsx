import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {useParams} from 'sentry/utils/useParams';

import {LinkTeamForm} from './linkTeamForm';
import type {LinkTeamContext} from './types';

interface LinkTeamContentProps {
  context: LinkTeamContext;
  signedParams: string;
}

function LinkTeamContent({context, signedParams}: LinkTeamContentProps) {
  if (context.organizations.length === 0) {
    return (
      <Alert variant="warning">
        {t(
          'None of your organizations have this Slack workspace installed. Ask an organization owner or manager to install it first.'
        )}
      </Alert>
    );
  }

  return (
    <LinkTeamForm organizations={context.organizations} signedParams={signedParams} />
  );
}

function SlackLinkTeamBody({signedParams}: {signedParams: string}) {
  const {
    data: context,
    isPending,
    isError,
    error,
  } = useQuery({
    ...apiOptions.as<LinkTeamContext>()('/integrations/slack/link-team/$signedParams/', {
      path: {signedParams},
      staleTime: Infinity,
    }),
    retry: false,
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <Alert variant="danger">{getRequestErrorUserMessage(error)}</Alert>;
  }

  return (
    <Stack gap="xl">
      <Stack gap="md">
        <Heading as="h3" size="xl">
          {tct('Link a team to [channel]', {channel: `#${context.channelName}`})}
        </Heading>
        <Text as="p">
          {t(
            'Choose a team. Its issue alert notifications will be sent to this Slack channel.'
          )}
        </Text>
      </Stack>
      <LinkTeamContent context={context} signedParams={signedParams} />
    </Stack>
  );
}

export default function SlackLinkTeam() {
  const {signedParams} = useParams<{signedParams: string}>();

  return (
    <NarrowLayout>
      <SentryDocumentTitle title={t('Link Team to Slack')} />
      <SlackLinkTeamBody signedParams={signedParams} />
    </NarrowLayout>
  );
}
