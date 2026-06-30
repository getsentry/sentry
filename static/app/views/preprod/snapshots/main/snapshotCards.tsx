import {Fragment, memo, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  IconFile,
  IconInfo,
  IconLightning,
  IconLink,
  IconMoon,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import type {ContentVariant} from 'sentry/utils/theme/types';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';
import {
  DiffStatus,
  getImageName,
  getSnapshotImageUrl,
} from 'sentry/views/preprod/types/snapshotTypes';

import type {DiffMode} from './imageDisplay/diffImageDisplay';
import {CollapsibleBadgeRow} from './collapsibleBadgeRow';
import {
  ImageColumn,
  OnionCardBody,
  SplitPairBody,
  WipeCardBody,
} from './snapshotDiffBodies';
import {SnapshotCanvasWrapper, SnapshotVariantFrame} from './snapshotFrames';

export function DarkAware({
  isDark,
  children,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  if (!isDark) {
    return <Fragment>{children}</Fragment>;
  }
  const siteIsDark = ConfigStore.get('theme') === 'dark';
  return (
    <ThemeProvider theme={siteIsDark ? lightTheme : darkTheme}>{children}</ThemeProvider>
  );
}

export function ErroredBanner() {
  return (
    <Container padding="0 xl md">
      <Alert variant="danger" showIcon>
        {t(
          'Unknown error: failed to compare these images (base and head images still shown below).'
        )}
      </Alert>
    </Container>
  );
}

export const PairCard = memo(function PairCard({
  pair,
  imageBaseUrl,
  headBranch,
  isSelected,
  copyUrl,
  diffMode,
  overlayColor,
  diffImageBaseUrl,
  snapshotKey,
  status = DiffStatus.CHANGED,
  onSelectSnapshot,
  onOpenSnapshot,
  onCopyLink,
  onCopyMetadata,
}: {
  copyUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  isSelected: boolean;
  pair: SnapshotDiffPair;
  snapshotKey: string;
  diffImageBaseUrl?: string;
  headBranch?: string | null;
  onCopyLink?: () => void;
  onCopyMetadata?: () => void;
  onOpenSnapshot?: (key: string) => void;
  onSelectSnapshot?: (key: string | null) => void;
  overlayColor?: string;
  status?: DiffStatus;
}) {
  const [isDark, setIsDark] = useState(false);
  const image = pair.head_image;
  const baseUrl = getSnapshotImageUrl(imageBaseUrl, pair.base_image);
  const headUrl = getSnapshotImageUrl(imageBaseUrl, image);

  const handleSelect = onSelectSnapshot
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectSnapshot(isSelected ? null : snapshotKey);
      }
    : undefined;
  const handleOpen = onOpenSnapshot ? () => onOpenSnapshot(snapshotKey) : undefined;

  const effectiveDiffMode = status === DiffStatus.ERRORED ? 'split' : diffMode;

  let body: React.ReactNode;
  if (effectiveDiffMode === 'split') {
    body = (
      <SnapshotCanvasWrapper>
        <SplitPairBody
          baseUrl={baseUrl}
          headUrl={headUrl}
          baseImage={pair.base_image}
          headImage={image}
          headLabel={headBranch ?? t('Head')}
          altPrefix={getImageName(image)}
          overlayColor={overlayColor}
          diffImageKey={pair.diff_image_key}
          diffImageBaseUrl={diffImageBaseUrl}
        />
      </SnapshotCanvasWrapper>
    );
  } else if (effectiveDiffMode === 'wipe') {
    body = (
      <WipeCardBody
        baseUrl={baseUrl}
        headUrl={headUrl}
        baseImage={pair.base_image}
        headImage={image}
      />
    );
  } else {
    body = (
      <OnionCardBody
        baseUrl={baseUrl}
        headUrl={headUrl}
        baseImage={pair.base_image}
        headImage={image}
      />
    );
  }

  return (
    <DarkAware isDark={isDark}>
      <SnapshotVariantFrame
        isSelected={isSelected}
        data-snapshot-key={snapshotKey}
        onClick={handleSelect}
      >
        <CardHeader
          displayName={image.display_name}
          fileName={image.image_file_name}
          tags={image.tags}
          status={status}
          diffPercent={pair.diff}
          isDark={isDark}
          onToggleDark={() => setIsDark(v => !v)}
          copyData={pair}
          copyUrl={copyUrl}
          onDoubleClick={handleOpen}
          showBottomBorder={false}
          onCopyLink={onCopyLink}
          onCopyMetadata={onCopyMetadata}
        />
        {status === DiffStatus.ERRORED && <ErroredBanner />}
        <Container padding="0 xl xl">{body}</Container>
      </SnapshotVariantFrame>
    </DarkAware>
  );
});

export const ImageCard = memo(function ImageCard({
  image,
  cardType,
  copyData,
  imageBaseUrl,
  isSelected,
  copyUrl,
  snapshotKey,
  onSelectSnapshot,
  onOpenSnapshot,
  onCopyLink,
  onCopyMetadata,
}: {
  cardType: 'added' | 'removed' | 'renamed' | 'solo' | 'unchanged' | 'skipped';
  copyUrl: string;
  image: SnapshotImage;
  imageBaseUrl: string;
  isSelected: boolean;
  snapshotKey: string;
  copyData?: unknown;
  onCopyLink?: () => void;
  onCopyMetadata?: () => void;
  onOpenSnapshot?: (key: string) => void;
  onSelectSnapshot?: (key: string | null) => void;
}) {
  const [isDark, setIsDark] = useState(false);
  const imageUrl = getSnapshotImageUrl(imageBaseUrl, image);
  let status: DiffStatus | null;
  switch (cardType) {
    case 'solo':
      status = null;
      break;
    case 'added':
      status = DiffStatus.ADDED;
      break;
    case 'removed':
      status = DiffStatus.REMOVED;
      break;
    case 'renamed':
      status = DiffStatus.RENAMED;
      break;
    case 'skipped':
      status = DiffStatus.SKIPPED;
      break;
    case 'unchanged':
    default:
      status = DiffStatus.UNCHANGED;
  }

  const handleSelect = onSelectSnapshot
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectSnapshot(isSelected ? null : snapshotKey);
      }
    : undefined;
  const handleOpen = onOpenSnapshot ? () => onOpenSnapshot(snapshotKey) : undefined;

  return (
    <DarkAware isDark={isDark}>
      <SnapshotVariantFrame
        isSelected={isSelected}
        data-snapshot-key={snapshotKey}
        onClick={handleSelect}
      >
        <CardHeader
          displayName={image.display_name}
          fileName={image.image_file_name}
          tags={image.tags}
          status={status}
          isDark={isDark}
          onToggleDark={() => setIsDark(v => !v)}
          copyData={copyData ?? image}
          copyUrl={copyUrl}
          onDoubleClick={handleOpen}
          showBottomBorder={false}
          onCopyLink={onCopyLink}
          onCopyMetadata={onCopyMetadata}
        />
        <Container padding="0 xl xl">
          <ImageColumn src={imageUrl} alt={getImageName(image)} image={image} />
        </Container>
      </SnapshotVariantFrame>
    </DarkAware>
  );
});

export const CardHeader = memo(function CardHeader({
  displayName,
  fileName,
  tags,
  status,
  diffPercent,
  isDark,
  onToggleDark,
  copyData,
  copyUrl,
  onDoubleClick,
  showBottomBorder = true,
  onCopyLink,
  onCopyMetadata,
}: {
  copyData: unknown;
  copyUrl: string;
  fileName: string;
  isDark: boolean;
  onToggleDark: () => void;
  diffPercent?: number | null;
  displayName?: string | null;
  onCopyLink?: () => void;
  onCopyMetadata?: () => void;
  onDoubleClick?: () => void;
  showBottomBorder?: boolean;
  status?: DiffStatus | null;
  tags?: Record<string, string> | null;
}) {
  const {copy} = useCopyToClipboard();
  return (
    <CardHeaderRow onDoubleClick={onDoubleClick} $showBottomBorder={showBottomBorder}>
      <Flex align="center" justify="between" gap="md">
        <Flex align="center" width="fit-content" maxWidth="100%" minWidth="0">
          <Text size="md" bold ellipsis>
            {displayName ?? fileName}
          </Text>
          {displayName && (
            <IconButton
              aria-label={t('Copy file name')}
              tooltip={fileName}
              icon={<IconFile size="xs" />}
              onClick={e => {
                e.stopPropagation();
                copy(fileName, {successMessage: t('Copied file name')});
              }}
            />
          )}
        </Flex>
        <Flex align="center" gap="sm" flex="0 0 auto" onClick={e => e.stopPropagation()}>
          {status && <StatusBadge status={status} diffPercent={diffPercent} />}
          <IconButton
            aria-label={isDark ? t('Light preview') : t('Dark preview')}
            tooltip={isDark ? t('Light preview') : t('Dark preview')}
            icon={isDark ? <IconLightning size="sm" /> : <IconMoon size="sm" />}
            onClick={onToggleDark}
          />
          <IconButton
            aria-label={t('Copy link to this snapshot')}
            tooltip={t('Copy link')}
            icon={<IconLink size="sm" />}
            onClick={() => {
              copy(copyUrl, {successMessage: t('Copied link to this snapshot')});
              onCopyLink?.();
            }}
          />
          <MetadataInfoButton copyData={copyData} onCopy={onCopyMetadata} />
        </Flex>
      </Flex>
      {tags && Object.keys(tags).length > 0 && <CollapsibleBadgeRow tags={tags} />}
    </CardHeaderRow>
  );
});

function MetadataTooltip({json}: {json: string}) {
  return (
    <Stack gap="xs" minWidth="260px">
      <MetadataHint>{t('Click info icon to copy metadata')}</MetadataHint>
      <CodeBlock language="json" hideCopyButton isRounded={false}>
        {json}
      </CodeBlock>
    </Stack>
  );
}

const METADATA_BLOCKLIST = new Set(['key', 'diff_image_key']);

function MetadataInfoButton({
  copyData,
  onCopy,
}: {
  copyData: unknown;
  onCopy?: () => void;
}) {
  const {copy} = useCopyToClipboard();
  const json = JSON.stringify(
    copyData,
    (k, v) => (METADATA_BLOCKLIST.has(k) || v === null ? undefined : v),
    2
  );

  return (
    <Tooltip title={<MetadataTooltip json={json} />} maxWidth={480} isHoverable>
      <InfoIconButton
        type="button"
        aria-label={t('Copy metadata as JSON')}
        onClick={() => {
          copy(json, {successMessage: t('Copied metadata as JSON')});
          onCopy?.();
        }}
      >
        <IconInfo size="sm" />
      </InfoIconButton>
    </Tooltip>
  );
}

const STATUS_VARIANT: Record<DiffStatus, ContentVariant | 'muted' | 'secondary'> = {
  [DiffStatus.CHANGED]: 'accent',
  [DiffStatus.ADDED]: 'success',
  [DiffStatus.REMOVED]: 'danger',
  [DiffStatus.RENAMED]: 'warning',
  [DiffStatus.UNCHANGED]: 'secondary',
  [DiffStatus.ERRORED]: 'danger',
  [DiffStatus.SKIPPED]: 'muted',
};

const StatusBadge = memo(function StatusBadge({
  status,
  diffPercent,
}: {
  status: DiffStatus;
  diffPercent?: number | null;
}) {
  if (status === DiffStatus.ERRORED) {
    return (
      <Tag variant="danger" icon={<IconWarning />}>
        {t('Failed to compare')}
      </Tag>
    );
  }

  let label: string;
  switch (status) {
    case DiffStatus.CHANGED:
      label =
        diffPercent === null || diffPercent === undefined
          ? t('Changed')
          : t('Changed - %s', formatPercentage(diffPercent, diffPercent >= 0.01 ? 1 : 3));
      break;
    case DiffStatus.ADDED:
      label = t('Added');
      break;
    case DiffStatus.REMOVED:
      label = t('Removed');
      break;
    case DiffStatus.RENAMED:
      label = t('Renamed');
      break;
    case DiffStatus.SKIPPED:
      label = t('Skipped');
      break;
    default:
      label = t('Unchanged');
  }

  return (
    <Text size="sm" bold variant={STATUS_VARIANT[status]}>
      {label}
    </Text>
  );
});

function IconButton({
  icon,
  'aria-label': ariaLabel,
  onClick,
  tooltip,
}: {
  'aria-label': string;
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  tooltip?: string;
}) {
  const button = (
    <Button
      size="xs"
      variant="transparent"
      icon={icon}
      aria-label={ariaLabel}
      onClick={onClick}
    />
  );
  if (!tooltip) {
    return button;
  }
  return (
    <Tooltip title={tooltip} skipWrapper>
      {button}
    </Tooltip>
  );
}

const CardHeaderRow = styled('div')<{
  $showBottomBorder?: boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xs']};
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  border-bottom: ${p =>
    p.$showBottomBorder ? `1px solid ${p.theme.tokens.border.secondary}` : 0};
`;

const InfoIconButton = styled('button')`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: ${p => p.theme.tokens.content.secondary};
  border-radius: ${p => p.theme.radius.sm};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    background: ${p => p.theme.tokens.background.secondary};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.tokens.focus.default};
    outline-offset: 1px;
  }
`;

const MetadataHint = styled('div')`
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
  padding-bottom: ${p => p.theme.space.xs};
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
`;
