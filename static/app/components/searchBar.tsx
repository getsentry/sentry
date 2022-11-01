import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {
  Input,
  InputGroup,
  InputLeadingItems,
  InputProps,
  InputTrailingItems,
} from 'sentry/components/inputGroup';
import {IconSearch} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

interface SearchBarProps extends Omit<InputProps, 'onChange'> {
  defaultQuery?: string;
  onChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  query?: string;
  width?: string;
}

function SearchBar({
  query: queryProp,
  defaultQuery = '',
  onChange,
  onSearch,
  width,
  size,
  className,
  ...inputProps
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(queryProp ?? defaultQuery);

  const onQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const {value} = e.target;
      setQuery(value);
      onChange?.(value);
    },
    [onChange]
  );

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      inputRef.current?.blur();
      onSearch?.(query);
    },
    [onSearch, query]
  );

  const clearSearch = useCallback(() => {
    setQuery('');
    onChange?.('');
    onSearch?.('');
  }, [onChange, onSearch]);

  return (
    <FormWrap onSubmit={onSubmit} className={className}>
      <InputGroup>
        <InputLeadingItems disablePointerEvents>
          <IconSearch color="subText" size={size === 'xs' ? 'xs' : 'sm'} />
        </InputLeadingItems>
        <StyledInput
          {...inputProps}
          ref={inputRef}
          type="text"
          name="query"
          autoComplete="off"
          value={query}
          onChange={onQueryChange}
          width={width}
          size={size}
        />
        <InputTrailingItems>
          {!!query && (
            <SearchClearButton
              type="button"
              size="zero"
              borderless
              onClick={clearSearch}
              icon={<IconClose size="xs" />}
              aria-label={t('Clear')}
            />
          )}
        </InputTrailingItems>
      </InputGroup>
    </FormWrap>
  );
}

const FormWrap = styled('form')`
  display: block;
  position: relative;
`;

const StyledInput = styled(Input)`
  ${p => p.width && `width: ${p.width};`}
`;

const SearchClearButton = styled(Button)`
  color: ${p => p.theme.subText};
  padding: ${space(0.5)};
`;

export default SearchBar;
