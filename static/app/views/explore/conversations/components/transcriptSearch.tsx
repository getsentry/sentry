import {Fragment, useState, type RefObject} from 'react';
import {css, Global, useTheme} from '@emotion/react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconClose} from '@sentry/icons/close';
import {IconSearch} from '@sentry/icons/search';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useTranscriptSearch} from 'sentry/views/explore/conversations/hooks/useTranscriptSearch';

const MAX_QUERY_LENGTH = 256;

interface TranscriptSearchProps {
  canLoadMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  onSelectSpan: (spanId: string) => void;
  rootRef: RefObject<HTMLElement | null>;
}

export function TranscriptSearch({
  rootRef,
  canLoadMore,
  isLoadingMore,
  loadMore,
  onSelectSpan,
}: TranscriptSearchProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const search = useTranscriptSearch({
    rootRef,
    canLoadMore,
    isLoadingMore,
    loadMore,
    onSelectSpan,
  });

  const status =
    search.status === 'searching'
      ? t('Searching…')
      : search.status === 'no-results'
        ? t('No results')
        : null;

  const counter =
    search.status === 'found' && search.index !== null
      ? `${search.index + 1}/${search.matchCount}${search.hasMore ? '+' : ''}`
      : null;

  const handleClear = () => {
    setQuery('');
    search.clear();
  };

  return (
    <Container
      position="sticky"
      top="0"
      padding="sm"
      background="primary"
      borderBottom="primary"
      style={{zIndex: 1}}
    >
      <Global
        styles={css`
          ::highlight(conversation-search-match) {
            background-color: ${theme.colors.yellow100};
          }
          ::highlight(conversation-search-current) {
            background-color: ${theme.colors.yellow300};
          }
        `}
      />
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch variant="muted" size="xs" />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          size="xs"
          type="text"
          autoComplete="off"
          maxLength={MAX_QUERY_LENGTH}
          placeholder={t('Search in transcript')}
          aria-label={t('Search in transcript')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && query.trim()) {
              search.submit(query.trim(), e.shiftKey);
            }
          }}
        />
        {status || counter || query ? (
          <InputGroup.TrailingItems>
            {status ? (
              <Text size="sm" variant="muted">
                {status}
              </Text>
            ) : null}
            {counter ? (
              <Fragment>
                <Text size="sm" variant="muted" tabular>
                  {counter}
                </Text>
                <Button
                  size="zero"
                  variant="transparent"
                  icon={<IconChevron size="xs" />}
                  aria-label={t('Previous match')}
                  onClick={search.previous}
                />
                <Button
                  size="zero"
                  variant="transparent"
                  icon={<IconChevron size="xs" direction="down" />}
                  aria-label={t('Next match')}
                  onClick={search.next}
                />
              </Fragment>
            ) : null}
            {query ? (
              <Button
                size="zero"
                variant="transparent"
                icon={<IconClose size="xs" />}
                aria-label={t('Clear')}
                onClick={handleClear}
              />
            ) : null}
          </InputGroup.TrailingItems>
        ) : null}
      </InputGroup>
    </Container>
  );
}
