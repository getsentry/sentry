import {useState} from 'react';
import {IconClose} from '@sentry/icons/close';
import {IconSearch} from '@sentry/icons/search';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';

import {t} from 'sentry/locale';

export function ConversationSearchInput() {
  const [query, setQuery] = useState('');

  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <IconSearch variant="muted" size="xs" />
      </InputGroup.LeadingItems>
      <InputGroup.Input
        size="xs"
        type="text"
        autoComplete="off"
        placeholder={t('Search in conversation')}
        aria-label={t('Search in conversation')}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {query ? (
        <InputGroup.TrailingItems>
          <Button
            size="zero"
            variant="transparent"
            icon={<IconClose size="xs" />}
            aria-label={t('Clear')}
            onClick={() => setQuery('')}
          />
        </InputGroup.TrailingItems>
      ) : null}
    </InputGroup>
  );
}
