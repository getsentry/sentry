import {openInsightInfoModal} from 'sentry/actionCreators/modal';
import {CodeBlock} from 'sentry/components/core/code';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import {t, tct} from 'sentry/locale';
import {
  CodeBlockWrapper,
  InlineCode,
} from 'sentry/views/preprod/buildDetails/main/insights/insightInfoModal';

const COMMENT_EXAMPLE = `/* Title for the expired code alert. */
"code_expired" = "Code Expired";`;

const STRIP_STRINGS_SCRIPT = `#!/usr/bin/env python3
import json
import os
import subprocess


def minify(file_path: str) -> None:
    subprocess.run(["plutil", "-convert", "json", file_path], check=True)

    with open(file_path, "r", encoding="utf-8") as source:
        data = json.load(source)

    with open(file_path, "w", encoding="utf-8") as target:
        for key, value in data.items():
            target.write(f'"{key}" = "{value}";\\n')


for root, _, files in os.walk(os.environ["BUILT_PRODUCTS_DIR"], followlinks=True):
    for filename in files:
        if filename.endswith(".strings"):
            path = os.path.join(root, filename)
            print(f"Minifying {path}")
            minify(path)`;

function getMinifyLocalizedStringsContent() {
  return (
    <Flex direction="column" gap="2xl">
      <Text>
        {t(
          'Xcode localized string bundles often ship with translator comments, whitespace, and legacy encodings that the runtime never reads. Trimming that excess reduces download size without touching what users see.'
        )}
      </Text>

      <Flex direction="column" gap="xl">
        <Flex direction="column" gap="md">
          <Heading as="h3" size="md">
            {t('Option 1: Keep the format lean')}
          </Heading>
          <Text>
            {tct(
              'Use the newer [link:String Catalog] to store strings in a more efficient format. Ensure [key] to get an efficient encoding that automatically strips whitespace and comments.',
              {
                link: (
                  <ExternalLink href="https://developer.apple.com/documentation/xcode/localizing-and-varying-text-with-a-string-catalog" />
                ),
                key: <InlineCode>STRINGS_FILE_OUTPUT_ENCODING = binary</InlineCode>,
              }
            )}
          </Text>
        </Flex>

        <Flex direction="column" gap="md">
          <Heading as="h3" size="md">
            {t('Option 2: Strip comments automatically')}
          </Heading>
          <Text>
            {t(
              'If strings are encoded as text, these files can have extra comments and whitespace that ship with the bundle. They help during translation but take space in production. A typical comment may look like:'
            )}
          </Text>
          <CodeBlockWrapper>
            <CodeBlock language="text" filename="Localizable.strings">
              {COMMENT_EXAMPLE}
            </CodeBlock>
          </CodeBlockWrapper>
          <Text>
            {t(
              'You can automatically strip comments by adding a Run Script build phase that converts each `.strings` file to JSON, rewrites it without comments, and leaves a compact UTF-8 file behind:'
            )}
          </Text>
          <ol>
            <li>
              <Text>
                {tct(
                  'In Xcode, open [menu] and add a new Run Script phase after the localized resources step.',
                  {
                    menu: (
                      <InlineCode>Build Phases → + → New Run Script Phase</InlineCode>
                    ),
                  }
                )}
              </Text>
            </li>
            <li>
              <Text>
                {tct(
                  'Point the shell to your Python 3 binary (for Homebrew on Apple Silicon: [binary]).',
                  {binary: <InlineCode>/opt/homebrew/bin/python3</InlineCode>}
                )}
              </Text>
            </li>
            <li>
              <Text>
                {t('Paste the script below and commit your annotated originals.')}
              </Text>
            </li>
          </ol>
          <Text>
            {t(
              'The script converts each `.strings` file to JSON, rewrites it without comments, and leaves a compact UTF-8 file behind.'
            )}
          </Text>
          <CodeBlockWrapper>
            <CodeBlock language="python" filename="minify_strings.py">
              {STRIP_STRINGS_SCRIPT}
            </CodeBlock>
          </CodeBlockWrapper>
          <Text>
            {t(
              'This script strips comments and blank lines after the files are generated, so keep the original annotated copies under version control for translators.'
            )}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
}

export function openMinifyLocalizedStringsModal() {
  openInsightInfoModal({
    title: t('Minify localized strings'),
    children: getMinifyLocalizedStringsContent(),
  });
}
