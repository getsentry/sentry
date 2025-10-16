import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

interface FixInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export function FixInsightModal({isOpen, onClose}: FixInsightModalProps) {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('heic');

  if (!isOpen) {
    return null;
  }

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
      <AnimatePresence>
        {isOpen && (
          <Fragment>
            <Backdrop
              key="fix-modal-backdrop"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.2}}
              onClick={onClose}
            />
            <ModalContainer
              key="fix-modal-content"
              initial={{opacity: 0, scale: 0.95, x: '-50%', y: '-50%'}}
              animate={{opacity: 1, scale: 1, x: '-50%', y: '-50%'}}
              exit={{opacity: 0, scale: 0.95, x: '-50%', y: '-50%'}}
              transition={{duration: 0.2}}
              onClick={e => e.stopPropagation()}
            >
              <Flex direction="column" gap="lg" style={{width: '100%', minWidth: 0}}>
                <Flex justify="between" align="center">
                  <Heading as="h2" size="lg">
                    {t('Optimize alternate app icons')}
                  </Heading>
                  <Button
                    size="sm"
                    icon={<IconClose />}
                    aria-label={t('Close modal')}
                    onClick={onClose}
                  />
                </Flex>

                <Flex direction="column" gap="md" style={{minWidth: 0}}>
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
                          {t('Save the script as')} <Code>optimize.sh</Code>
                        </Text>
                      </li>
                      <li>
                        <Text>
                          {t('Run:')} <Code>source optimize.sh</Code>
                        </Text>
                      </li>
                      <li>
                        <Text>
                          {t('Optimize your images:')} <Code>{exampleCommand}</Code>
                        </Text>
                      </li>
                    </OrderedList>
                  </Flex>
                </Flex>
              </Flex>
            </ModalContainer>
          </Fragment>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

const Backdrop = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  pointer-events: auto;
`;

const ModalContainer = styled(motion.div)`
  position: fixed;
  top: 50%;
  left: 50%;
  width: 90%;
  max-width: 700px;
  height: auto;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.xl};
  z-index: 10001;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  overflow: hidden;
`;

const CodeBlockWrapper = styled('div')`
  max-height: 300px;
  overflow: auto;
  min-width: 0;
  width: 100%;
  padding: ${p => p.theme.space.sm} 0;
`;

const Code = styled('code')`
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.borderRadius};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.purple300};
`;

const OrderedList = styled('ol')`
  margin: 0;
  padding-left: ${p => p.theme.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};

  li {
    color: ${p => p.theme.textColor};
  }
`;
