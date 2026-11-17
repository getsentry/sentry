import {useState} from 'react';
import {IconClose} from '@sentry/icons/close';
import {IconSearch} from '@sentry/icons/search';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

const MAX_QUERY_LENGTH = 256;

interface ConversationSearchInputProps {
  onClear: () => void;
  onSearch: (query: string) => void;
  status: string | null;
}

export function ConversationSearchInput({
  onClear,
  onSearch,
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
            onSearch(query.trim());
          }
        }}
      />
      {status || query ? (
        <InputGroup.TrailingItems>
          {status ? (
            <Text size="sm" variant="muted">
              {status}
            </Text>
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
