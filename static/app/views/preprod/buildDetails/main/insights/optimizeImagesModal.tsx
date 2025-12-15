import type {ReactNode} from 'react';

import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Heading} from '@sentry/scraps/text/heading';

import {openInsightInfoModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {CodeBlockWrapper} from 'sentry/views/preprod/buildDetails/main/insights/insightInfoModal';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';

const IOS_IMAGEMIN_SCRIPT = `# Install imagemin-cli
npm install -g imagemin-cli

# Optimize PNG with quality 85
npx imagemin input.png --plugin=pngquant --pngquant.quality=0.85-0.85 > output.png

# Optimize JPEG with quality 85
npx imagemin input.jpg --plugin=mozjpeg --plugin.mozjpeg.quality=85 > output.jpg`;

const ANDROID_CWEBP_SCRIPT = `# Install cwebp (on Mac)
brew install webp

# Convert PNG to lossless WebP
cwebp -lossless input.png -o output.webp

# Convert JPEG to lossless WebP
cwebp -lossless input.jpg -o output.webp`;

function getOptimizeImagesContent(platform?: Platform): ReactNode {
  return platform === 'android' ? (
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
              {ANDROID_CWEBP_SCRIPT}
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
  ) : (
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
              {IOS_IMAGEMIN_SCRIPT}
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
  );
}

export function openOptimizeImagesModal(platform?: Platform) {
  const title =
    platform === 'android'
      ? t('Optimize Images (Android)')
      : platform === 'ios'
        ? t('Optimize Images (iOS)')
        : t('Optimize Images');

  openInsightInfoModal({
    title,
    children: getOptimizeImagesContent(platform),
  });
}
