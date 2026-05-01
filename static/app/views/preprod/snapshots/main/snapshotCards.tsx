import {Fragment, memo, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CodeBlock} from '@sentry/scraps/code';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconInfo, IconLightning, IconLink, IconMoon} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
// eslint-disable-next-line no-restricted-imports
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';
import {DiffStatus, getImageName} from 'sentry/views/preprod/types/snapshotTypes';

import type {DiffMode} from './imageDisplay/diffImageDisplay';
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
  onSelectSnapshot,
  onOpenSnapshot,
}: {
  copyUrl: string;
  diffMode: DiffMode;
  imageBaseUrl: string;
  isSelected: boolean;
  pair: SnapshotDiffPair;
  snapshotKey: string;
  diffImageBaseUrl?: string;
  headBranch?: string | null;
  onOpenSnapshot?: (key: string) => void;
  onSelectSnapshot?: (key: string | null) => void;
  overlayColor?: string;
}) {
  const [isDark, setIsDark] = useState(false);
  const image = pair.head_image;
  const baseUrl = `${imageBaseUrl}${pair.base_image.key}/`;
  const headUrl = `${imageBaseUrl}${image.key}/`;

  const handleSelect = onSelectSnapshot
    ? (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectSnapshot(isSelected ? null : snapshotKey);
      }
    : undefined;
  const handleOpen = onOpenSnapshot ? () => onOpenSnapshot(snapshotKey) : undefined;

  let body: React.ReactNode;
  if (diffMode === 'split') {
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
  } else if (diffMode === 'wipe') {
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
          status={DiffStatus.CHANGED}
          diffPercent={pair.diff}
          isDark={isDark}
          onToggleDark={() => setIsDark(v => !v)}
          copyData={pair}
          copyUrl={copyUrl}
          onDoubleClick={handleOpen}
          showBottomBorder={false}
        />
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
}: {
  cardType: 'added' | 'removed' | 'renamed' | 'solo' | 'unchanged';
  copyUrl: string;
  image: SnapshotImage;
  imageBaseUrl: string;
  isSelected: boolean;
  snapshotKey: string;
  copyData?: unknown;
  onOpenSnapshot?: (key: string) => void;
  onSelectSnapshot?: (key: string | null) => void;
}) {
  const [isDark, setIsDark] = useState(false);
  const imageUrl = `${imageBaseUrl}${image.key}/`;
  let status: DiffStatus | null;
  if (cardType === 'solo') {
    status = null;
  } else if (cardType === 'added') {
    status = DiffStatus.ADDED;
  } else if (cardType === 'removed') {
    status = DiffStatus.REMOVED;
  } else if (cardType === 'renamed') {
    status = DiffStatus.RENAMED;
  } else {
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
          status={status}
          isDark={isDark}
          onToggleDark={() => setIsDark(v => !v)}
          copyData={copyData ?? image}
          copyUrl={copyUrl}
          onDoubleClick={handleOpen}
          showBottomBorder={false}
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
  status,
  diffPercent,
  isDark,
  onToggleDark,
  copyData,
  copyUrl,
  onDoubleClick,
  showBottomBorder = true,
}: {
  copyData: unknown;
  copyUrl: string;
  fileName: string;
  isDark: boolean;
  onToggleDark: () => void;
  diffPercent?: number | null;
  displayName?: string | null;
  onDoubleClick?: () => void;
  showBottomBorder?: boolean;
  status?: DiffStatus | null;
}) {
  const {copy} = useCopyToClipboard();
  return (
    <CardHeaderRow onDoubleClick={onDoubleClick} $showBottomBorder={showBottomBorder}>
      <Stack gap="xs" minWidth="0" flex="1">
        {displayName ? (
          <Fragment>
            <Text size="md" bold ellipsis>
              {displayName}
            </Text>
            <Text size="xs" variant="muted" monospace ellipsis>
              {fileName}
            </Text>
          </Fragment>
        ) : (
          <Text size="md" bold monospace ellipsis>
            {fileName}
          </Text>
        )}
      </Stack>
      <Flex align="center" gap="sm" onClick={e => e.stopPropagation()}>
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
          onClick={() =>
            copy(copyUrl, {successMessage: t('Copied link to this snapshot')})
          }
        />
        <MetadataInfoButton copyData={copyData} />
      </Flex>
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

function MetadataInfoButton({copyData}: {copyData: unknown}) {
  const {copy} = useCopyToClipboard();
  const json = JSON.stringify(copyData, null, 2);

  return (
    <Tooltip title={<MetadataTooltip json={json} />} maxWidth={480} isHoverable>
      <InfoIconButton
        type="button"
        aria-label={t('Copy metadata as JSON')}
        onClick={() => copy(json, {successMessage: t('Copied metadata as JSON')})}
      >
        <IconInfo size="sm" />
      </InfoIconButton>
    </Tooltip>
  );
}

const StatusBadge = memo(function StatusBadge({
  status,
  diffPercent,
}: {
  status: DiffStatus;
  diffPercent?: number | null;
}) {
  let label: string;
  switch (status) {
    case DiffStatus.CHANGED:
      label =
        diffPercent === null || diffPercent === undefined
          ? t('Modified')
          : t(
              'Modified - %s',
              formatPercentage(diffPercent, diffPercent >= 0.01 ? 1 : 4)
            );
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
    default:
      label = t('Unchanged');
  }

  return <StatusBadgeContainer status={status}>{label}</StatusBadgeContainer>;
});

function IconButton({
  icon,
  'aria-label': ariaLabel,
  onClick,
  tooltip,
}: {
  'aria-label': string;
  icon: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
}) {
  const button = (
    <Button
      size="xs"
      priority="transparent"
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
  align-items: flex-start;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
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

const StatusBadgeContainer = styled('span')<{status: DiffStatus}>`
  display: inline-flex;
  align-items: center;
  padding: 2px ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.sm};
  font-size: ${p => p.theme.font.size.xs};
  white-space: nowrap;
  background: ${p => {
    switch (p.status) {
      case DiffStatus.CHANGED:
        return p.theme.tokens.background.transparent.accent.muted;
      case DiffStatus.ADDED:
        return p.theme.tokens.background.transparent.success.muted;
      case DiffStatus.REMOVED:
        return p.theme.tokens.background.transparent.danger.muted;
      case DiffStatus.RENAMED:
        return p.theme.tokens.background.transparent.warning.muted;
      case DiffStatus.UNCHANGED:
      default:
        return p.theme.tokens.background.secondary;
    }
  }};
  color: ${p => {
    switch (p.status) {
      case DiffStatus.CHANGED:
        return p.theme.tokens.content.accent;
      case DiffStatus.ADDED:
        return p.theme.tokens.content.success;
      case DiffStatus.REMOVED:
        return p.theme.tokens.content.danger;
      case DiffStatus.RENAMED:
        return p.theme.tokens.content.warning;
      case DiffStatus.UNCHANGED:
      default:
        return p.theme.tokens.content.secondary;
    }
  }};
`;
