import {useRef} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from '@sentry/scraps/input';

import {Search} from 'sentry/components/search';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useHotkeys} from 'sentry/utils/useHotkeys';

const MIN_SEARCH_LENGTH = 1;
const MAX_RESULTS = 10;

function SettingsSearch() {
  const searchInput = useRef<HTMLInputElement>(null);

  useHotkeys([{match: '/', callback: () => searchInput.current?.focus()}]);

  return (
    <Search
      entryPoint="settings_search"
      minSearch={MIN_SEARCH_LENGTH}
      maxResults={MAX_RESULTS}
      renderInput={({getInputProps}) => (
        <InputGroup>
          <InputGroup.LeadingItems>
            <IconSearch size="sm" />
          </InputGroup.LeadingItems>
          <StyledSearchInput
            size="sm"
            aria-label={t('Search Settings')}
            {...getInputProps({type: 'text', placeholder: t('Search')})}
            ref={searchInput}
          />
        </InputGroup>
      )}
    />
  );
}

export default SettingsSearch;

const StyledSearchInput = styled(InputGroup.Input)`
  width: 100px;
  @media (min-width: ${p => p.theme.breakpoints.md}) {
    width: 260px;
  }
`;
