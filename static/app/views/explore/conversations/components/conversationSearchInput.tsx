import {Fragment, useState} from 'react';
import {IconChevron} from '@sentry/icons/chevron';
import {IconClose} from '@sentry/icons/close';
import {IconSearch} from '@sentry/icons/search';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

const MAX_QUERY_LENGTH = 256;

interface ConversationSearchInputProps {
  counter: string | null;
  onClear: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: (query: string, backwards: boolean) => void;
  status: string | null;
}

export function ConversationSearchInput({
  counter,
  onClear,
  onNext,
  onPrevious,
  onSubmit,
  status,
}: ConversationSearchInputProps) {
  const [query, setQuery] = useState('');

  const handleClear = () => {
    setQuery('');
    onClear();
  };

  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch variant="muted" size="xs" />
      </InputGroup.LeadingItems>
      <InputGroup.Input
        size="xs"
        type="text"
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        placeholder={t('Search in conversation')}
        aria-label={t('Search in conversation')}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && query.trim()) {
            onSubmit(query.trim(), e.shiftKey);
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
                onClick={onPrevious}
              />
              <Button
                size="zero"
                variant="transparent"
                icon={<IconChevron size="xs" direction="down" />}
                aria-label={t('Next match')}
                onClick={onNext}
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
  );
}
