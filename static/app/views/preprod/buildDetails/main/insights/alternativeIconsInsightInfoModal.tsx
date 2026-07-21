import {Fragment} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {openInsightInfoModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {
  CodeBlockWrapper,
  InlineCode,
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

function AlternativeIconsContent() {
  return (
    <Fragment>
      <Text>
        {t(
          'Use this script to optimize your images locally. It reduces file sizes by simulating homescreen quality (180px → 1024px) and converts to HEIC format.'
        )}
      </Text>

      <Container padding="md 0">
        <Alert variant="warning">
          {t(
            "Reminder: If you convert your image to HEIC, make sure to update the reference in your app's project to use this new filepath!"
          )}
        </Alert>
      </Container>

      <CodeBlockWrapper>
        <CodeBlock language="bash" filename="optimize.sh">
          {HEIC_SCRIPT}
        </CodeBlock>
      </CodeBlockWrapper>

      <Stack gap="sm">
        <Heading as="h3" size="md">
          {t('How to use:')}
        </Heading>
        <ol>
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
              {t('Optimize your images:')}{' '}
              <InlineCode>optimize_icon YourImage.png</InlineCode>
            </Text>
          </li>
        </ol>
      </Stack>
    </Fragment>
  );
}

export function openAlternativeIconsInsightModal() {
  openInsightInfoModal({
    title: t('Optimize alternate app icons'),
    children: <AlternativeIconsContent />,
  });
}
