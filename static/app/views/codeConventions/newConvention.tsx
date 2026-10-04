import {useEffect, useRef} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ConventionEditForm} from 'sentry/views/codeConventions/conventionEditForm';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

const EMPTY_CONVENTION = {name: ''};

// Sent with the user's reply so the agent knows what it's helping write.
const NEW_CONVENTION_CONTEXT = {
  page: 'New code convention',
  description:
    'The user is writing a new @sentry/refactor-tasks convention: a YAML file in ' +
    '.sentry-refactor-tasks/conventions of getsentry/sentry. Each one has a name, ' +
    'a severity, tags, and Markdown sections: why (the rationale), detect (how to ' +
    'spot a violation), fix (how to correct one), examples (bad and good code ' +
    'snippets), plus a grep prefilter or detect_command that picks the files to scan.',
};

export default function NewConvention() {
  const organization = useOrganization();
  const {openChatPrompt} = useSeerExplorerContext();
  const hasPromptedRef = useRef(false);

  const canAskSeer =
    isSeerExplorerEnabled(organization) &&
    organization.features.includes('seer-explorer-chat-prompts');

  // Offer help once when the page opens, not again if the prompt callback
  // changes identity while the user is here.
  useEffect(() => {
    if (!canAskSeer || hasPromptedRef.current) {
      return;
    }
    hasPromptedRef.current = true;
    openChatPrompt({
      prompt: t('Do you need help describing a new convention?'),
      context: NEW_CONVENTION_CONTEXT,
    });
  }, [canAskSeer, openChatPrompt]);

  return (
    <SentryDocumentTitle
      title={`${t('New Convention')} — ${t('Code Quality')}`}
      orgSlug={organization.slug}
    >
      <Stack flex={1}>
        <Layout.Title>
          <Flex align="center" gap="sm">
            {t('New Convention')}
            <FeatureBadge type="alpha" />
          </Flex>
        </Layout.Title>
        <Layout.Body>
          <Layout.Main width="full">
            <Container maxWidth="900px">
              <ConventionEditForm convention={EMPTY_CONVENTION} />
            </Container>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
