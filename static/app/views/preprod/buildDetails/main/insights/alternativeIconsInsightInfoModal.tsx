import {Fragment, useState} from 'react';

import {openInsightInfoModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {CodeBlock} from 'sentry/components/core/code';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import {
  CodeBlockWrapper,
  InlineCode,
  OrderedList,
} from 'sentry/views/preprod/buildDetails/main/insights/insightInfoModal';

const HEIC_SCRIPT = `#!/bin/bash
#
# Icon Optimizer for iOS Apps (HEIC)
# Reduces alternate icon file sizes by resizing to homescreen quality (180px → 1024px) and converts to HEIC format
#
# Usage:  optimize_icon MyIcon.png

optimize_icon() {
    local input="$1"
    local output="$(basename "$input" | sed 's/\\.[^.]*$//')_optimized.heic"

    [ ! -f "$input" ] && echo "❌ File not found: $input" && return 1

    echo "🔄 Optimizing $(basename "$input")..."

    # Resize: original → 180px → 1024px (simulates homescreen quality)
    sips --resampleWidth 180 "$input" --out /tmp/icon.png >/dev/null 2>&1 || return 1
    sips --resampleWidth 1024 /tmp/icon.png -s format heic -s formatOptions 85 --out "$output" >/dev/null 2>&1

    rm /tmp/icon.png

    if [ -f "$output" ]; then
        local saved=$(( ($(stat -f%z "$input") - $(stat -f%z "$output")) / 1024 ))
        echo "✅ Saved \${saved}KB → $output"
    else
        echo "❌ Optimization failed"
        return 1
    fi
}`;

const PNG_SCRIPT = `#!/bin/bash
#
# Icon Optimizer for iOS Apps (PNG)
# Reduces alternate icon file sizes by resizing to homescreen quality (180px → 1024px)
#
# Usage:  optimize_icon MyIcon.png

optimize_icon() {
    local input="$1"
    local output="$(basename "$input" | sed 's/\\.[^.]*$//')_optimized.png"

    [ ! -f "$input" ] && echo "❌ File not found: $input" && return 1

    echo "🔄 Optimizing $(basename "$input")..."

    # Resize: original → 180px → 1024px (simulates homescreen quality)
    sips --resampleWidth 180 "$input" --out /tmp/icon.png >/dev/null 2>&1 || return 1
    sips --resampleWidth 1024 /tmp/icon.png --out "$output" >/dev/null 2>&1

    rm /tmp/icon.png

    if [ -f "$output" ]; then
        local saved=$(( ($(stat -f%z "$input") - $(stat -f%z "$output")) / 1024 ))
        echo "✅ Saved \${saved}KB → $output"
    else
        echo "❌ Optimization failed"
        return 1
    fi
}`;

type OutputFormat = 'heic' | 'png';

function AlternativeIconsContent() {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('heic');

  const currentScript = outputFormat === 'heic' ? HEIC_SCRIPT : PNG_SCRIPT;
  const exampleCommand = 'optimize_icon YourImage.png';

  const description =
    outputFormat === 'heic'
      ? t(
          'Use this script to optimize your images locally. It reduces file sizes by simulating homescreen quality (180px → 1024px) and converts to HEIC format.'
        )
      : t(
          'Use this script to optimize your images locally. It reduces file sizes by simulating homescreen quality (180px → 1024px) and keeps them as PNG files.'
        );

  return (
    <Fragment>
      <Text>{description}</Text>

      <Container padding="md 0">
        <RadioGroup
          label={t('Output format')}
          value={outputFormat}
          choices={[
            ['heic', t('Convert to HEIC')],
            ['png', t('Optimize PNG')],
          ]}
          onChange={(value: string) => setOutputFormat(value as OutputFormat)}
          orientInline
        />
      </Container>

      {outputFormat === 'heic' && (
        <Alert type="warning">
          {t(
            "Reminder: If you convert your image to HEIC, make sure to update the reference in your app's project to use this new filepath!"
          )}
        </Alert>
      )}

      <CodeBlockWrapper>
        <CodeBlock language="bash" filename="optimize.sh">
          {currentScript}
        </CodeBlock>
      </CodeBlockWrapper>

      <Flex direction="column" gap="sm">
        <Heading as="h3" size="md">
          {t('How to use:')}
        </Heading>
        <OrderedList>
          <li>
            <Text>
              {t('Save the script as')} <InlineCode>optimize.sh</InlineCode>
            </Text>
          </li>
          <li>
            <Text>
              {t('Run:')} <InlineCode>source optimize.sh</InlineCode>
            </Text>
          </li>
          <li>
            <Text>
              {t('Optimize your images:')} <InlineCode>{exampleCommand}</InlineCode>
            </Text>
          </li>
        </OrderedList>
      </Flex>
    </Fragment>
  );
}

export function openAlternativeIconsInsightModal() {
  openInsightInfoModal({
    title: t('Optimize alternate app icons'),
    children: <AlternativeIconsContent />,
  });
}
