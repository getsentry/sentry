import {LinkButton} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {List} from 'sentry/components/list';
import {ListItem} from 'sentry/components/list/listItem';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';

const PRODUCT_DOC_URL = 'https://docs.sentry.io/product/snapshots/';
const CI_DOC_URL = 'https://docs.sentry.io/product/snapshots/integrating-into-ci/';

function getUploadCommand(projectSlug: string | undefined) {
  return [
    'sentry-cli snapshots upload ./snapshots \\',
    '  --auth-token "$SENTRY_AUTH_TOKEN" \\',
    '  --app-id <app-id> \\',
    `  --project ${projectSlug ?? '<project-slug>'}`,
  ].join('\n');
}

type Props = {
  onDocsClick?: (linkType: 'product' | 'ci') => void;
  projectSlug?: string;
};

export function SnapshotsOnboardingPanel({projectSlug, onDocsClick}: Props) {
  return (
    <Panel>
      <PanelBody>
        <Flex
          direction={{xs: 'column', lg: 'row'}}
          align="start"
          width="100%"
          padding="3xl"
          gap="2xl"
        >
          <Stack flex={1} minWidth={0} gap="md">
            <Heading as="h2" size="2xl">
              {t('Catch visual changes before they ship')}
            </Heading>
            <Text as="p" size="md">
              {t('Diff screenshots against your base branch on every pull request')}
            </Text>
            <List symbol="bullet">
              <ListItem>{t('Upload screenshots from any tool in CI')}</ListItem>
              <ListItem>{t('Get a GitHub status check on every PR')}</ListItem>
              <ListItem>{t('Review and approve changes in Sentry')}</ListItem>
            </List>
            <Flex gap="md" wrap="wrap" marginTop="md">
              <LinkButton
                href={PRODUCT_DOC_URL}
                external
                variant="primary"
                size="md"
                onClick={() => onDocsClick?.('product')}
              >
                {t('Product Docs')}
              </LinkButton>
              <LinkButton
                href={CI_DOC_URL}
                external
                size="md"
                onClick={() => onDocsClick?.('ci')}
              >
                {t('Set Up in CI')}
              </LinkButton>
            </Flex>
          </Stack>
          <Container flex={1} minWidth={0} width="100%">
            <Stack gap="sm">
              <Text size="sm" variant="muted">
                {t('Upload from CI')}
              </Text>
              <CodeBlock language="bash">{getUploadCommand(projectSlug)}</CodeBlock>
            </Stack>
          </Container>
        </Flex>
      </PanelBody>
    </Panel>
  );
}
