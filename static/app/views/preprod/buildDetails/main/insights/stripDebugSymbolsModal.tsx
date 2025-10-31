import {Alert} from '@sentry/scraps/alert';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Heading} from '@sentry/scraps/text/heading';

import {openInsightInfoModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {CodeBlockWrapper} from 'sentry/views/preprod/buildDetails/main/insights/insightInfoModal';

const STRIP_SINGLE_BINARY = `strip -rSTx AppBinary -o AppBinaryStripped`;

const STRIP_BUILD_SCRIPT = `#!/bin/bash
set -e

if [ "Release" != "\${CONFIGURATION}" ]; then
  echo "Skipping symbol stripping for \${CONFIGURATION} build."
  exit 0
fi

APP_DIR_PATH="\${BUILT_PRODUCTS_DIR}/\${EXECUTABLE_FOLDER_PATH}"
echo "Stripping main binary: \${APP_DIR_PATH}/\${EXECUTABLE_NAME}"
strip -rSTx "\${APP_DIR_PATH}/\${EXECUTABLE_NAME}"

APP_FRAMEWORKS_DIR="\${APP_DIR_PATH}/Frameworks"
if [ -d "\${APP_FRAMEWORKS_DIR}" ]; then
  find "\${APP_FRAMEWORKS_DIR}" -maxdepth 2 -mindepth 2 -type f -perm -111 -exec bash -c '
    codesign -v -R="anchor apple" "$1" &> /dev/null || strip -rSTx "$1"
  ' _ {} \\;
fi`;

const DSYM_INPUT_FILE =
  '${DWARF_DSYM_FOLDER_PATH}/${EXECUTABLE_NAME}.app.dSYM/\\\nContents/Resources/DWARF/${EXECUTABLE_NAME}';

function getStripDebugSymbolsContent() {
  return (
    <Flex direction="column" gap="2xl">
      <Text>
        {t(
          'Debug info and symbols are only used during development and should not be shipped to users.'
        )}
      </Text>

      <Flex direction="column" gap="xl">
        <Flex direction="column" gap="md">
          <Heading as="h3" size="md">
            {t('How to fix')}
          </Heading>
          <Text>
            {t(
              'Strip symbols from release builds and instead rely on separate dSYM files for crash reporters.'
            )}
          </Text>
          <Alert type="warning">
            {t(
              'Stripping symbols before creating a dSYM breaks crash symbolication. Confirm your release build still produces and uploads dSYMs (or another crash reporter has them) before stripping.'
            )}
          </Alert>
          <Text>
            {t(
              'In Xcode, ensure your release configuration sets the Debug Information Format build setting to DWARF with dSYM.'
            )}
          </Text>
          <Text>
            {t('You can manually strip a compiled binary with the strip command:')}
          </Text>
          <CodeBlockWrapper>
            <CodeBlock language="bash" filename="strip.sh">
              {STRIP_SINGLE_BINARY}
            </CodeBlock>
          </CodeBlockWrapper>
        </Flex>

        <Flex direction="column" gap="md">
          <Heading as="h3" size="md">
            {t('Automate stripping after build')}
          </Heading>
          <Alert type="warning">
            {t(
              'This script will strip the main app binary along with any binaries in the Frameworks/ directory. This is a sample script that may require adjustments for your project.'
            )}
          </Alert>
          <Text>
            {t(
              'Add a Run Script phase that skips non-release builds and leaves Apple-signed frameworks untouched:'
            )}
          </Text>
          <CodeBlockWrapper>
            <CodeBlock language="bash" filename="strip_debug_symbols.sh">
              {STRIP_BUILD_SCRIPT}
            </CodeBlock>
          </CodeBlockWrapper>
          <Text>
            {t(
              'Because Xcode generates dSYMs from the unstripped binary, list the dSYM as an Input File so the script runs after Xcode finishes generating it:'
            )}
          </Text>
          <CodeBlockWrapper>
            <CodeBlock language="bash" filename="RunScript.inputfiles">
              {DSYM_INPUT_FILE}
            </CodeBlock>
          </CodeBlockWrapper>
        </Flex>
      </Flex>
    </Flex>
  );
}

export function openStripDebugSymbolsModal() {
  openInsightInfoModal({
    title: t('Strip debug symbols'),
    children: getStripDebugSymbolsContent(),
  });
}
