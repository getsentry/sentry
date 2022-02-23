import {useRef} from 'react';
import {useHotkeys} from 'react-hotkeys-hook';
import styled from '@emotion/styled';

import {Search} from 'sentry/components/search';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';

const MIN_SEARCH_LENGTH = 1;
const MAX_RESULTS = 10;

function SettingsSearch() {
  const searchInput = useRef<HTMLInputElement>(null);

  useHotkeys('/', e => {
    e.preventDefault();
    searchInput.current?.focus();
  });

  return (
    <Search
      entryPoint="settings_search"
      minSearch={MIN_SEARCH_LENGTH}
      maxResults={MAX_RESULTS}
      renderInput={({getInputProps}) => (
        <SearchInputWrapper>
          <SearchInputIcon size="14px" />
          <SearchInput
            {...getInputProps({type: 'text', placeholder: t('Search')})}
            ref={searchInput}
          />
        </SearchInputWrapper>
      )}
    />
  );
}

export default SettingsSearch;

const SearchInputWrapper = styled('div')`
  position: relative;
`;

const SearchInputIcon = styled(IconSearch)`
  color: ${p => p.theme.gray300};
  position: absolute;
  left: 10px;
  top: 8px;
`;

const SearchInput = styled('input')`
  color: ${p => p.theme.formText};
  background-color: ${p => p.theme.background};
  transition: border-color 0.15s ease;
  font-size: 14px;
  width: 260px;
  line-height: 1;
  padding: 5px 8px 4px 28px;
  border: 1px solid ${p => p.theme.border};
  border-radius: 30px;
  height: 28px;

  box-shadow: inset ${p => p.theme.dropShadowLight};

  &:focus {
    outline: none;
    border: 1px solid ${p => p.theme.border};
  }

  &::placeholder {
    color: ${p => p.theme.formPlaceholder};
  }
`;
