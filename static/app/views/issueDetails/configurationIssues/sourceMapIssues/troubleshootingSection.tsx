import {LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Prose, Text} from '@sentry/scraps/text';

import {ExternalLink} from 'sentry/components/links/externalLink';
import {IconDocs, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

interface TroubleshootingSectionProps {
  project: Project;
}

export function TroubleshootingSection({project}: TroubleshootingSectionProps) {
  const organization = useOrganization();
  const settingsUrl = `/settings/${organization.slug}/projects/${project.slug}/source-maps/`;

  return (
    <Stack gap="md" padding="lg">
      <Heading as="h3">{t('Troubleshooting suggestions')}</Heading>
      <Stack gap="sm">
        <Disclosure size="md" defaultExpanded>
          <Disclosure.Title>{t('Verify Artifacts Are Uploaded')}</Disclosure.Title>
          <Disclosure.Content>
            <Stack gap="lg">
              <Text>
                {t(
                  'For Sentry to de-minify your stack traces you must provide both the minified files (for example, app.min.js) and the corresponding source maps. You can find them at:'
                )}
              </Text>
              <div>
                <LinkButton
                  size="sm"
                  priority="primary"
                  icon={<IconSettings />}
                  to={settingsUrl}
                >
                  {t('Settings')}
                </LinkButton>
              </div>
            </Stack>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure size="md">
          <Disclosure.Title>
            {t("Verify That You're Building Source Maps")}
          </Disclosure.Title>
          <Disclosure.Content>
            <Prose>
              <p>
                {tct(
                  'Bundlers and tools (like [tsc]) that generate code, often require you to manually set specific options to generate source maps.',
                  {tsc: <InlineCode>tsc</InlineCode>}
                )}
              </p>
              <p>
                {tct(
                  'If you followed one of our tool-specific guides, verify you configured your tool to emit source maps and that the source maps contain your original source code in the [sourcesContent] field.',
                  {sourcesContent: <InlineCode>sourcesContent</InlineCode>}
                )}
              </p>
            </Prose>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure size="md">
          <Disclosure.Title>
            {t("Verify That You're Running a Production Build")}
          </Disclosure.Title>
          <Disclosure.Content>
            <Prose>
              <p>
                {t(
                  'When running JavaScript build tools (like webpack, Vite, ...) in development-mode/watch-mode, the generated code is sometimes incompatible with our source map uploading processes.'
                )}
              </p>
              <p>
                {t(
                  'We recommend, especially when testing locally, to run a production build to verify your source maps uploading setup.'
                )}
              </p>
            </Prose>
          </Disclosure.Content>
        </Disclosure>
        <Disclosure size="md">
          <Disclosure.Title>
            {t('Verify Your Source Files Contain Debug ID Injection Snippets')}
          </Disclosure.Title>
          <Disclosure.Content>
            <Prose>
              <p>
                {tct(
                  'In the JavaScript files you uploaded to Sentry, search for code that roughly looks like [snippet]. This code snippet might look different depending on how you process your code.',
                  {
                    snippet: (
                      <InlineCode>{'e._sentryDebugIds=e._sentryDebugIds||{}'}</InlineCode>
                    ),
                  }
                )}
              </p>
              <p>
                {t(
                  'If this code exists in a bundle, that bundle will be able to be matched to a source file. Every bundle you deploy in your app needs to have this snippet in order to be correctly source mapped.'
                )}
              </p>
              <p>
                {tct(
                  "If your source code does not contain this snippet and you're using a Sentry plugin for your bundler, please check that you are using the latest version and please verify that the plugin is correctly processing your files. Set the [debug] option to [true] to print useful debugging information.",
                  {
                    debug: <InlineCode>debug</InlineCode>,
                    true: <InlineCode>true</InlineCode>,
                  }
                )}
              </p>
              <p>
                {tct(
                  "If you're using the Sentry CLI, verify that you're running the [inject] command before you upload to Sentry and before you deploy your files.",
                  {inject: <InlineCode>inject</InlineCode>}
                )}
              </p>
            </Prose>
          </Disclosure.Content>
        </Disclosure>
        <Flex paddingTop="sm" align="center" gap="sm">
          <Text variant="muted">{t('Not what you\u2019re looking for?')}</Text>
          <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/">
            <Flex align="center" gap="xs">
              <IconDocs size="xs" />
              {t('Read all documentation')}
            </Flex>
          </ExternalLink>
        </Flex>
      </Stack>
    </Stack>
  );
}
