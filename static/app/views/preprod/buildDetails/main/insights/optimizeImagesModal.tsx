import {Fragment} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Heading} from 'sentry/components/core/text/heading';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

interface OptimizeImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: string;
}

export function OptimizeImagesModal({
  isOpen,
  onClose,
  platform: rawPlatform,
}: OptimizeImagesModalProps) {
  if (!isOpen) {
    return null;
  }

  // Normalize platform to lowercase for comparison
  const platform = rawPlatform?.toLowerCase();

  return (
    <Fragment>
      <AnimatePresence>
        {isOpen && (
          <Fragment>
            <Backdrop
              key="optimize-images-backdrop"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.2}}
              onClick={onClose}
            />
            <ModalContainer
              key="optimize-images-content"
              initial={{opacity: 0, scale: 0.95, x: '-50%', y: '-50%'}}
              animate={{opacity: 1, scale: 1, x: '-50%', y: '-50%'}}
              exit={{opacity: 0, scale: 0.95, x: '-50%', y: '-50%'}}
              transition={{duration: 0.2}}
              onClick={e => e.stopPropagation()}
            >
              <Flex direction="column" gap="lg" style={{width: '100%', minWidth: 0}}>
                <Flex justify="between" align="center">
                  <Heading as="h2" size="lg">
                    {platform === 'ios'
                      ? t('Optimize Images (iOS)')
                      : platform === 'android'
                        ? t('Optimize Images (Android)')
                        : t('Optimize Images')}
                  </Heading>
                  <Button
                    size="sm"
                    icon={<IconClose />}
                    aria-label={t('Close modal')}
                    onClick={onClose}
                  />
                </Flex>

                <Flex direction="column" gap="md" style={{minWidth: 0}}>
                  {platform === 'ios' ? (
                    <Flex direction="column" gap="2xl">
                      <Text>
                        {t(
                          'We find all large images in your app and determine if their size could be reduced or updated to more optimized image formats. We will show an optimized image insight for any image whose size can be reduced by more than 4KB through lossy compression or converted to HEIC format (for apps targeting iOS 12 or later).'
                        )}
                      </Text>

                      <Flex direction="column" gap="xl">
                        <Flex direction="column" gap="sm">
                          <Heading as="h3" size="md">
                            {t('Option 1: Use Imagemin (Command-line)')}
                          </Heading>
                          <CodeBlockWrapper>
                            <CodeBlock language="bash" filename="optimize.sh">
                              {`# Install imagemin-cli
npm install -g imagemin-cli

# Optimize PNG with quality 85
imagemin input.png --plugin=pngquant --plugin.quality=[0.85,0.85] > output.png

# Optimize JPEG with quality 85
imagemin input.jpg --plugin=mozjpeg --plugin.quality=85 > output.jpg`}
                            </CodeBlock>
                          </CodeBlockWrapper>
                        </Flex>

                        <Flex direction="column" gap="sm">
                          <Heading as="h3" size="md">
                            {t('Option 2: Use ImageOptim (GUI)')}
                          </Heading>
                          <Text>
                            {t(
                              'Download ImageOptim for Mac, drag and drop your images to compress them with lossy compression.'
                            )}
                          </Text>
                        </Flex>

                        <Flex direction="column" gap="sm">
                          <Heading as="h3" size="md">
                            {t('Option 3: Convert to HEIC')}
                          </Heading>
                          <Text>
                            {t(
                              'Open the image in Preview, choose File → Export, then select HEIC from the format dropdown.'
                            )}
                          </Text>
                        </Flex>
                      </Flex>
                    </Flex>
                  ) : (
                    <Flex direction="column" gap="2xl">
                      <Text>
                        {t(
                          'We find all large images in your app and determine if their size could be reduced or updated to more optimized image formats. We find all PNG or JPEG files in your resources or assets directory and compare them to lossless WebP versions. If there is a size reduction, we will recommend using WebP.'
                        )}
                      </Text>

                      <Flex direction="column" gap="xl">
                        <Flex direction="column" gap="sm">
                          <Heading as="h3" size="md">
                            {t('Option 1: Use Android Studio')}
                          </Heading>
                          <Text>
                            {t(
                              'Right-click an image in Android Studio, select "Convert to WebP", and choose lossless conversion.'
                            )}
                          </Text>
                        </Flex>

                        <Flex direction="column" gap="sm">
                          <Heading as="h3" size="md">
                            {t('Option 2: Use cwebp (Command-line)')}
                          </Heading>
                          <CodeBlockWrapper>
                            <CodeBlock language="bash" filename="convert-webp.sh">
                              {`# Install cwebp (on Mac)
brew install webp

# Convert PNG to lossless WebP
cwebp -lossless input.png -o output.webp

# Convert JPEG to lossless WebP
cwebp -lossless input.jpg -o output.webp`}
                            </CodeBlock>
                          </CodeBlockWrapper>
                        </Flex>

                        <Text variant="muted" size="sm">
                          {t(
                            'Note: Based on minSdkVersion >= 18, lossless WebP is recommended. For versions < 18, assets with alpha channels are skipped.'
                          )}
                        </Text>
                      </Flex>
                    </Flex>
                  )}
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
