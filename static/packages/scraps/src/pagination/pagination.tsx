import type * as React from 'react';
import {createContext, useContext} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Button, ButtonBar, type ButtonProps} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

export type CursorHandler = (cursor: string | undefined, delta: -1 | 1) => void;

/** Opaque cursor and availability supplied by the consumer. */
export interface PaginationPage {
  cursor?: string;
  disabled?: boolean;
}

export interface PaginationProps {
  caption?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  next?: PaginationPage;
  /** Override the configured navigation for this pagination instance. */
  onCursor?: CursorHandler;
  /** Observe page changes without overriding the configured navigation. */
  onPageChange?: CursorHandler;
  previous?: PaginationPage;
  size?: ButtonProps['size'];
}

const PaginationBehaviorContext = createContext<CursorHandler | undefined>(undefined);

/** Supply default cursor navigation while individual instances can override it. */
export const PaginationBehaviorContextProvider = PaginationBehaviorContext.Provider;

/** Cursor formats and navigation belong to consumers. */
export function Pagination({
  className,
  onCursor,
  onPageChange,
  previous,
  next,
  size = 'sm',
  caption,
  disabled = false,
}: PaginationProps) {
  const {t} = useTranslation();
  const defaultOnCursor = useContext(PaginationBehaviorContext);
  const handleCursor = onCursor ?? defaultOnCursor;

  if (previous === undefined && next === undefined) {
    return null;
  }
  const previousDisabled =
    disabled || !handleCursor || previous === undefined || previous.disabled === true;
  const nextDisabled =
    disabled || !handleCursor || next === undefined || next.disabled === true;

  return (
    <Flex
      justify="end"
      align="center"
      margin="2xl 0 0 0"
      className={className}
      data-test-id="pagination"
    >
      {caption && <PaginationCaption>{caption}</PaginationCaption>}
      <ButtonBar>
        <Button
          icon={<IconChevron direction="left" />}
          aria-label={t('Previous')}
          size={size}
          disabled={previousDisabled}
          onClick={() => {
            handleCursor?.(previous?.cursor, -1);
            onPageChange?.(previous?.cursor, -1);
          }}
        />
        <Button
          icon={<IconChevron direction="right" />}
          aria-label={t('Next')}
          size={size}
          disabled={nextDisabled}
          onClick={() => {
            handleCursor?.(next?.cursor, 1);
            onPageChange?.(next?.cursor, 1);
          }}
        />
      </ButtonBar>
    </Flex>
  );
}

const PaginationCaption = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  margin-right: ${p => p.theme.space.xl};
`;
