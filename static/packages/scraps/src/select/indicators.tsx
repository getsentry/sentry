import type * as React from 'react';
import {css} from '@emotion/react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Spinner} from '@sentry/scraps/spinner';
import {useTranslation} from '@sentry/scraps/translation';

import type {getSelectStyles} from './styles';

export function SelectIndicators({
  dropdownIndicator,
  isLoading,
  onClear,
  selectStyles,
  showClearButton,
  trailingItems,
}: {
  onClear: () => void;
  selectStyles: Pick<ReturnType<typeof getSelectStyles>, 'clearIcon' | 'indicators'>;
  showClearButton: boolean;
  dropdownIndicator?: React.ReactNode;
  isLoading?: boolean;
  trailingItems?: React.ReactNode;
}) {
  const {t} = useTranslation();
  if (
    dropdownIndicator === null &&
    !showClearButton &&
    !isLoading &&
    (trailingItems == null || typeof trailingItems === 'boolean')
  ) {
    return null;
  }

  return (
    <Flex align="center" gap="xs" css={selectStyles.indicators}>
      <Grid
        flow="column"
        autoColumns="minmax(24px, max-content)"
        align="center"
        justifyItems="center"
        gap="xs"
        css={css`
          &:empty {
            display: none;
          }
        `}
      >
        {trailingItems}
        {showClearButton && (
          <Button
            size="zero"
            variant="transparent"
            aria-label={t('Clear choices')}
            icon={<IconClose css={selectStyles.clearIcon} />}
            onMouseDown={event => event.preventDefault()}
            onClick={onClear}
          />
        )}
        {isLoading && (
          <Spinner
            size={14}
            css={css`
              margin: 0;
            `}
          />
        )}
      </Grid>
      {dropdownIndicator !== null && (
        <Flex as="span" align="center" aria-hidden="true">
          {dropdownIndicator ?? <IconChevron direction="down" size="xs" />}
        </Flex>
      )}
    </Flex>
  );
}
