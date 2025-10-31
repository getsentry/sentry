import {openInsightInfoModal} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import {t, tct} from 'sentry/locale';
import {InlineCode} from 'sentry/views/preprod/buildDetails/main/insights/insightInfoModal';

function getMainBinaryExportedSymbolsContent() {
  return (
    <Flex direction="column" gap="2xl">
      <Flex direction="column" gap="xl">
        <Flex direction="column" gap="md">
          <Heading as="h3" size="md">
            {t('Main Binary Export Metadata')}
          </Heading>
          <Text>
            {tct(
              '[bold:What it is]: Binaries that act as entrypoints for your app, such as your main app binary or watchOS app binary, are not linked against by other binaries. This means the export trie information is unnecessary and can be removed.',
              {bold: <strong />}
            )}
          </Text>
          <Text>
            {tct(
              '[bold:How to fix]: Maintain a minimal allowlist so only required entry points stay exported.',
              {bold: <strong />}
            )}
          </Text>
        </Flex>

        <Flex direction="column" gap="md">
          <ol>
            <li>
              <Text>
                {tct('Create a text file in your project, for example [path]', {
                  path: <InlineCode>Config/ExportedSymbols.txt</InlineCode>,
                })}
              </Text>
            </li>
            <li>
              <Text>
                {tct('Add [main] on its own line', {
                  main: <InlineCode>_main</InlineCode>,
                  mh: <InlineCode>__mh_execute_header</InlineCode>,
                  dlsym: <InlineCode>dlsym</InlineCode>,
                })}
              </Text>
            </li>
            <li>
              <Text>
                {t('If you rely on other dynamic lookups, list those symbols too')}
              </Text>
            </li>
            <li>
              <Text>
                {tct('In Xcode, set [setting] to the new file’s path', {
                  setting: (
                    <strong>
                      {t('Build Settings → Linking → Exported Symbols File')}
                    </strong>
                  ),
                })}
              </Text>
            </li>
          </ol>
          <Text>{t('Xcode now limits the export trie to just that allowlist')}</Text>
        </Flex>
      </Flex>
    </Flex>
  );
}

export function openMainBinaryExportedSymbolsModal() {
  openInsightInfoModal({
    title: t('Main binary export metadata'),
    children: getMainBinaryExportedSymbolsContent(),
  });
}
