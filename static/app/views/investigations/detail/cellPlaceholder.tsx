import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';

type InvestigationCellPlaceholderProps = {
  className?: string;
  showTitle?: boolean;
  title?: string | null;
};

/** What a notebook cell looks like while Seer is still writing it. */
export function InvestigationCellPlaceholder({
  className,
  showTitle = true,
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
      {showTitle && title ? (
        <Heading as="h3" size="md">
          {title}
        </Heading>
      ) : null}
      {showTitle && !title ? (
        <PlaceholderLine
          height="20px"
          width="40%"
          testId="investigation-cell-placeholder-title"
        />
      ) : null}
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
