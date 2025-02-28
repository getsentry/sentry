import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import type {InputProps} from 'sentry/components/core/input/inputGroup';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {IconSearch} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface SearchBarProps extends Omit<InputProps, 'onChange'> {
  defaultQuery?: string;
  onChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  query?: string;
  trailing?: React.ReactNode;
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
  trailing,
  ...inputProps
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(queryProp ?? defaultQuery);

  // if query prop keeps changing we should treat this as
  // a controlled component and its internal state should be in sync
  useEffect(() => {
    if (typeof queryProp === 'string') {
      setQuery(queryProp);
    }
  }, [queryProp]);

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
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch color="subText" size={size === 'xs' ? 'xs' : 'sm'} />
        </InputGroup.LeadingItems>
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
        <InputGroup.TrailingItems>
          {trailing}
          {!!query && (
            <SearchBarTrailingButton
              size="zero"
              borderless
              onClick={clearSearch}
              icon={<IconClose size="xs" />}
              aria-label={t('Clear')}
            />
          )}
        </InputGroup.TrailingItems>
      </InputGroup>
    </FormWrap>
  );
}

const FormWrap = styled('form')`
  display: block;
  position: relative;
`;

const StyledInput = styled(InputGroup.Input)`
  ${p => p.width && `width: ${p.width};`}
`;

export const SearchBarTrailingButton = styled(Button)`
  color: ${p => p.theme.subText};
  padding: ${space(0.5)};
`;

export default SearchBar;
