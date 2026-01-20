import {Fragment, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Tag} from '@sentry/scraps/badge/tag';
import {Button} from '@sentry/scraps/button';
import {ButtonBar} from '@sentry/scraps/button/buttonBar';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconInfo} from 'sentry/icons';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconFlag} from 'sentry/icons/iconFlag';
import {t, tn} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import useOrganization from 'sentry/utils/useOrganization';
import {openAlternativeIconsInsightModal} from 'sentry/views/preprod/buildDetails/main/insights/alternativeIconsInsightInfoModal';
import {openMainBinaryExportedSymbolsModal} from 'sentry/views/preprod/buildDetails/main/insights/mainBinaryExportedSymbolsModal';
import {openMinifyLocalizedStringsModal} from 'sentry/views/preprod/buildDetails/main/insights/minifyLocalizedStringsModal';
import {openOptimizeImagesModal} from 'sentry/views/preprod/buildDetails/main/insights/optimizeImagesModal';
import {openStripDebugSymbolsModal} from 'sentry/views/preprod/buildDetails/main/insights/stripDebugSymbolsModal';
import type {
  FileSavingsResultGroup,
  OptimizableImageFile,
} from 'sentry/views/preprod/types/appSizeTypes';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
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
  'webp_optimization',
  'alternate_icons_optimization',
  'main_binary_exported_symbols',
  'localized_strings_minify',
  'strip_binary',
];

const DEFAULT_ITEMS_PER_PAGE = 20;

export function AppSizeInsightsSidebarRow({
  insight,
  isExpanded,
  onToggleExpanded,
  platform,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  projectType,
}: {
  insight: ProcessedInsight;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  itemsPerPage?: number;
  platform?: Platform;
  projectType?: string | null;
}) {
  const theme = useTheme();
  const organization = useOrganization();
  const shouldShowTooltip = INSIGHTS_WITH_MORE_INFO_MODAL.includes(insight.key);
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.ceil(insight.files.length / itemsPerPage);
  const startIndex = currentPage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFiles = insight.files.slice(startIndex, endIndex);
  const showPagination = insight.files.length > itemsPerPage;

  const handleOpenModal = () => {
    trackAnalytics('preprod.builds.details.open_insight_details_modal', {
      organization,
      insight_key: insight.key,
      platform: platform ?? null,
      project_type: projectType,
    });
    if (insight.key === 'alternate_icons_optimization') {
      openAlternativeIconsInsightModal();
    } else if (
      insight.key === 'image_optimization' ||
      insight.key === 'webp_optimization'
    ) {
      openOptimizeImagesModal(platform);
    } else if (insight.key === 'main_binary_exported_symbols') {
      openMainBinaryExportedSymbolsModal();
    } else if (insight.key === 'localized_strings_minify') {
      openMinifyLocalizedStringsModal();
    } else if (insight.key === 'strip_binary') {
      openStripDebugSymbolsModal();
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  useEffect(() => {
    if (!isExpanded) {
      setCurrentPage(0);
    }
  }, [isExpanded]);

  const handleToggleExpanded = () => {
    if (!isExpanded) {
      trackAnalytics('preprod.builds.details.expand_insight', {
        organization,
        insight_key: insight.key,
        platform: platform ?? null,
        project_type: projectType,
      });
    }
    onToggleExpanded();
  };

  return (
    <Flex border="muted" radius="md" padding="xl" direction="column" gap="md">
      <Flex align="start" justify="between">
        <Text variant="primary" size="md" bold>
          {insight.name}
        </Text>
        <Flex align="center" gap="sm" flexShrink={0}>
          <Text size="sm" tabular>
            {t('Potential savings %s', formatBytesBase10(insight.totalSavings))}
          </Text>
          <Tag variant="success" style={{minWidth: '56px', justifyContent: 'center'}}>
            <Text size="sm" tabular variant="success">
              {formatUpside(insight.percentage / 100)}
            </Text>
          </Tag>
        </Flex>
      </Flex>

      <Stack gap="lg" align="start">
        <Text variant="muted" size="sm">
          {insight.description}
        </Text>
        {shouldShowTooltip && (
          <Button priority="link" onClick={handleOpenModal} size="xs" icon={<IconInfo />}>
            {t('How to fix this locally')}
          </Button>
        )}
      </Stack>

      {insight.files.length > 0 && (
        <Container paddingTop="md">
          <Button
            size="sm"
            onClick={handleToggleExpanded}
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
            <Fragment>
              <Container
                display="flex"
                css={() => ({
                  flexDirection: 'column',
                  width: '100%',
                  overflow: 'hidden',
                  '& > :nth-child(odd)': {
                    backgroundColor: theme.tokens.background.secondary,
                  },
                })}
              >
                {currentFiles.map((file, fileIndex) => (
                  <FileRow key={`${file.path}-${startIndex + fileIndex}`} file={file} />
                ))}
              </Container>

              {showPagination && (
                <Flex align="center" justify="end" gap="md" paddingTop="md">
                  <Text size="sm" variant="muted">
                    {t('Page %s of %s', currentPage + 1, totalPages)}
                  </Text>
                  <ButtonBar merged gap="0">
                    <Button
                      icon={<IconChevron direction="left" />}
                      aria-label={t('Previous')}
                      size="xs"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0}
                    />
                    <Button
                      icon={<IconChevron direction="right" />}
                      aria-label={t('Next')}
                      size="xs"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages - 1}
                    />
                  </ButtonBar>
                </Flex>
              )}
            </Fragment>
          )}
        </Container>
      )}
    </Flex>
  );
}

function FileRow({file}: {file: ProcessedInsightFile}) {
  if (file.data.fileType === 'optimizable_image') {
    return <OptimizableImageFileRow file={file} originalFile={file.data.originalFile} />;
  }

  if (file.data.fileType === 'duplicate_files') {
    return <DuplicateGroupFileRow file={file} group={file.data.originalGroup} />;
  }

  return (
    <Flex
      align="center"
      justify="between"
      gap="lg"
      padding="xs sm"
      radius="sm"
      overflow="hidden"
      minWidth={0}
    >
      <Text size="sm" ellipsis style={{flex: 1}}>
        {file.path}
      </Text>
      <Text variant="primary" bold size="sm" tabular>
        -{formatBytesBase10(file.savings)}
      </Text>
    </Flex>
  );
}

function DuplicateGroupFileRow({
  file,
  group,
}: {
  file: ProcessedInsightFile;
  group: FileSavingsResultGroup;
}) {
  return (
    <Fragment key={file.path}>
      <Flex
        align="center"
        justify="between"
        gap="lg"
        padding="xs sm"
        radius="sm"
        overflow="hidden"
        minWidth={0}
      >
        <Text size="sm" ellipsis style={{flex: 1}} bold>
          {group.name}
        </Text>
        <Text variant="primary" bold size="sm" tabular>
          -{formatBytesBase10(file.savings)}
        </Text>
      </Flex>
      <Flex direction="column" gap="xs" padding="xs sm">
        {group.files.map((duplicateFile, index) => (
          <Flex key={`${duplicateFile.file_path}-${index}`} align="center" gap="sm">
            <Text size="xs" variant="muted" ellipsis style={{flex: 1, minWidth: 0}}>
              {duplicateFile.file_path}
            </Text>
            <Text
              size="xs"
              variant="muted"
              tabular
              align="right"
              style={{minWidth: '80px'}}
            >
              {formatBytesBase10(duplicateFile.total_savings)}
            </Text>
          </Flex>
        ))}
      </Flex>
    </Fragment>
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
    typeof originalFile.minified_size === 'number' && originalFile.minify_savings > 0;
  const hasHeicSavings =
    typeof originalFile.heic_size === 'number' && originalFile.conversion_savings > 0;

  const maxSavings = Math.max(
    originalFile.minify_savings || 0,
    originalFile.conversion_savings || 0
  );

  const hasMetadata =
    (originalFile.idiom || originalFile.colorspace) && file.data.isDuplicateVariant;
  // TODO (EME-460): Add link to formal documentation about idiom/colorspaces in apple binaries as well as more info about app thinning
  const tooltipContent = hasMetadata && (
    <Flex direction="column" gap="lg" align="start">
      <Text size="xs" align="left">
        {t(
          'This image shows up multiple times because this build likely did not have app thinning applied. That means your asset catalog can include different copies of the same image meant for different device types.'
        )}
      </Text>
      <Flex direction="column" gap="xs" align="start">
        {originalFile.idiom && (
          <Flex align="center" gap="xs">
            <Text size="xs">{t('Idiom:')}</Text>
            <Text size="xs">{originalFile.idiom}</Text>
          </Flex>
        )}
        {originalFile.colorspace && (
          <Flex align="center" gap="xs">
            <Text size="xs">{t('Colorspace:')}</Text>
            <Text size="xs">{originalFile.colorspace}</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );

  return (
    <Fragment key={file.path}>
      <Flex
        align="center"
        justify="between"
        gap="lg"
        padding="xs sm"
        radius="sm"
        overflow="hidden"
        minWidth={0}
      >
        <Flex align="center" gap="xs" overflow="hidden" minWidth={0}>
          <Text size="sm" ellipsis style={{flex: 1}}>
            {file.path}
          </Text>
          {hasMetadata && (
            <Tooltip title={tooltipContent} isHoverable skipWrapper>
              <Flex align="center" flexShrink={0}>
                <IconFlag size="xs" variant="muted" />
              </Flex>
            </Tooltip>
          )}
        </Flex>
        <Flex align="center" gap="sm">
          <Text variant="primary" bold size="sm" tabular>
            -{formatBytesBase10(maxSavings)}
          </Text>
        </Flex>
      </Flex>
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
              align="right"
              style={{minWidth: '80px'}}
            >
              -{formatBytesBase10(originalFile.minify_savings)}
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
              align="right"
              style={{minWidth: '80px'}}
            >
              -{formatBytesBase10(originalFile.conversion_savings)}
            </Text>
          </Flex>
        )}
      </Flex>
    </Fragment>
  );
}
