import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Container, Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t, tn} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {AlternativeIconsInsightInfoModal} from 'sentry/views/preprod/buildDetails/main/insights/alternativeIconsInsightInfoModal';
import {OptimizeImagesModal} from 'sentry/views/preprod/buildDetails/main/insights/optimizeImagesModal';
import type {OptimizableImageFile} from 'sentry/views/preprod/types/appSizeTypes';
import type {
  ProcessedInsight,
  ProcessedInsightFile,
} from 'sentry/views/preprod/utils/insightProcessing';

export function formatUpside(percentage: number): string {
  // percentage is between 0 and 1.
  if (percentage >= 0.001) {
    // Can't use formatPercentage minimumValue here since it doesn't
    // quite work with negative numbers.
    return `-${formatPercentage(percentage, 1)}`;
  }
  // Format smaller than 0.001 (so 0.1%) as "(~0%)"
  return `~0%`;
}

const INSIGHTS_WITH_MORE_INFO_MODAL = [
  'image_optimization',
  'alternate_icons_optimization',
];

export function AppSizeInsightsSidebarRow({
  insight,
  isExpanded,
  onToggleExpanded,
  platform,
}: {
  insight: ProcessedInsight;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  platform?: string;
}) {
  const theme = useTheme();
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);
  const shouldShowTooltip = INSIGHTS_WITH_MORE_INFO_MODAL.includes(insight.key);

  return (
    <Flex border="muted" radius="md" padding="xl" direction="column" gap="md">
      <Flex align="start" justify="between">
        <Text variant="primary" size="md" bold>
          {insight.name}
        </Text>
        <Flex
          align="center"
          gap="sm"
          style={{
            flexShrink: 0,
          }}
        >
          <Text size="sm" tabular>
            {t('Potential savings %s', formatBytesBase10(insight.totalSavings))}
          </Text>
          <Tag type="success" style={{minWidth: '56px', justifyContent: 'center'}}>
            <Text size="sm" tabular variant="success">
              {formatPercentage(insight.percentage / 100, 1)}
            </Text>
          </Tag>
        </Flex>
      </Flex>

      <Flex direction="column" gap="xs">
        <Text variant="muted" size="sm">
          {insight.description}
        </Text>
        {shouldShowTooltip && (
          <LinkText onClick={() => setIsFixModalOpen(true)}>
            {t('See how to fix this locally →')}
          </LinkText>
        )}
      </Flex>

      <Container>
        <Button
          size="sm"
          onClick={onToggleExpanded}
          style={{marginBottom: isExpanded ? '16px' : '0'}}
          icon={
            <IconChevron
              style={{
                transition: 'transform 0.2s ease',
                color: 'inherit',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(90deg)',
              }}
            />
          }
        >
          <Text variant="primary" size="md" bold>
            {tn('%s file', '%s files', insight.files.length)}
          </Text>
        </Button>

        {isExpanded && (
          <Container
            display="flex"
            css={() => ({
              flexDirection: 'column',
              width: '100%',
              overflow: 'hidden',
              '& > :nth-child(odd)': {
                backgroundColor: theme.backgroundSecondary,
              },
            })}
          >
            {insight.files.map((file, fileIndex) => (
              <FileRow key={`${file.path}-${fileIndex}`} file={file} />
            ))}
          </Container>
        )}
      </Container>

      {insight.key === 'alternate_icons_optimization' && (
        <AlternativeIconsInsightInfoModal
          isOpen={isFixModalOpen}
          onClose={() => setIsFixModalOpen(false)}
        />
      )}

      {insight.key === 'image_optimization' && (
        <OptimizeImagesModal
          isOpen={isFixModalOpen}
          onClose={() => setIsFixModalOpen(false)}
          platform={platform}
        />
      )}
    </Flex>
  );
}

function FileRow({file}: {file: ProcessedInsightFile}) {
  if (file.data.fileType === 'optimizable_image') {
    return <OptimizableImageFileRow file={file} originalFile={file.data.originalFile} />;
  }

  return (
    <FlexAlternatingRow>
      <Text size="sm" ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Flex align="center" gap="sm">
        <Text variant="primary" bold size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
        <Text variant="muted" size="sm" tabular align="right" style={{width: '64px'}}>
          ({formatUpside(file.percentage / 100)})
        </Text>
      </Flex>
    </FlexAlternatingRow>
  );
}

function OptimizableImageFileRow({
  file,
  originalFile,
}: {
  file: ProcessedInsightFile;
  originalFile: OptimizableImageFile;
}) {
  if (file.data.fileType !== 'optimizable_image') {
    return null;
  }

  const hasMinifySavings =
    originalFile.minified_size !== null && originalFile.minify_savings > 0;
  const hasHeicSavings =
    originalFile.heic_size !== null && originalFile.conversion_savings > 0;

  const maxSavings = Math.max(
    originalFile.minify_savings || 0,
    originalFile.conversion_savings || 0
  );

  return (
    <Container>
      <FlexAlternatingRow>
        <Text size="sm" ellipsis style={{flex: 1}}>
          {file.path}
        </Text>
        <Flex align="center" gap="sm">
          <Text variant="primary" bold size="sm" tabular>
            -{formatBytesBase10(maxSavings)}
          </Text>
          <Text variant="muted" size="sm" tabular align="right" style={{width: '64px'}}>
            ({formatUpside(file.percentage / 100)})
          </Text>
        </Flex>
      </FlexAlternatingRow>
      <Flex direction="column" gap="xs" padding="xs sm">
        {hasMinifySavings && (
          <Flex align="center" gap="sm">
            <Text size="xs" variant="muted" style={{minWidth: '100px'}}>
              {t('Optimize:')}
            </Text>
            <Text
              size="xs"
              variant="primary"
              tabular
              style={{minWidth: '80px', textAlign: 'right'}}
            >
              -{formatBytesBase10(originalFile.minify_savings)}
            </Text>
            <Text
              size="xs"
              variant="muted"
              tabular
              style={{minWidth: '64px', textAlign: 'right'}}
            >
              ({formatUpside(file.data.minifyPercentage / 100)})
            </Text>
          </Flex>
        )}
        {hasHeicSavings && (
          <Flex align="center" gap="sm">
            <Text size="xs" variant="muted" style={{minWidth: '100px'}}>
              {t('Convert to HEIC:')}
            </Text>
            <Text
              size="xs"
              variant="primary"
              tabular
              style={{minWidth: '80px', textAlign: 'right'}}
            >
              -{formatBytesBase10(originalFile.conversion_savings)}
            </Text>
            <Text
              size="xs"
              variant="muted"
              tabular
              style={{minWidth: '64px', textAlign: 'right'}}
            >
              ({formatUpside(file.data.conversionPercentage / 100)})
            </Text>
          </Flex>
        )}
      </Flex>
    </Container>
  );
}

const FlexAlternatingRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: ${({theme}) => theme.borderRadius};
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  gap: ${({theme}) => theme.space.lg};
  padding: ${({theme}) => theme.space.xs} ${({theme}) => theme.space.sm};
`;

const LinkText = styled('span')`
  color: ${p => p.theme.purple300};
  font-size: ${p => p.theme.fontSize.sm};
  cursor: pointer;
  text-decoration: underline;
  padding: ${p => p.theme.space.xs} 0;
  display: inline-block;

  &:hover {
    color: ${p => p.theme.purple400};
  }
`;
