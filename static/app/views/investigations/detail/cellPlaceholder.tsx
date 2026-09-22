import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';

type InvestigationCellPlaceholderProps = {
  className?: string;
  /**
   * Rendered in place of the title placeholder. Seer writes a block's title
   * before its output, so a cell that is still running usually has a real title
   * to show above the skeleton — only a cell that does not exist yet (the
   * report Seer is about to write) falls back to a placeholder title.
   */
  title?: string | null;
};

/**
 * The skeleton a notebook cell shows while Seer is still writing it.
 *
 * Deliberately shaped like the prose that replaces it — a title line and a few
 * lines of body — so the cell does not jump when the real content lands.
 */
export function InvestigationCellPlaceholder({
  className,
  title,
}: InvestigationCellPlaceholderProps) {
  return (
    <Stack
      className={className}
      gap="md"
      width="100%"
      minWidth={0}
      role="status"
      aria-label={title ? t('Loading %s', title) : t('Loading cell')}
      data-test-id="investigation-cell-placeholder"
    >
      {title ? (
        <Heading as="h3" size="md">
          {title}
        </Heading>
      ) : (
        <PlaceholderLine
          height="20px"
          width="40%"
          testId="investigation-cell-placeholder-title"
        />
      )}
      <Stack gap="sm" width="100%">
        <PlaceholderLine height="12px" />
        <PlaceholderLine height="12px" />
        <PlaceholderLine height="12px" width="65%" />
      </Stack>
    </Stack>
  );
}

const PlaceholderLine = styled(Placeholder)`
  border-radius: ${p => p.theme.radius.sm};
`;
