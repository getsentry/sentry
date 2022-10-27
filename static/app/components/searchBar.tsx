import {useCallback, useEffect, useRef, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Input, {InputProps} from 'sentry/components/input';
import {IconSearch} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';

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

  useEffect(() => {
    setQuery(queryProp ?? '');
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
        showClearButton={!!query}
      />
      <StyledIconSearch
        color="subText"
        size={size === 'xs' ? 'xs' : 'sm'}
        inputSize={size}
      />
      {!!query && (
        <SearchClearButton
          type="button"
          priority="link"
          onClick={clearSearch}
          size="xs"
          icon={<IconClose size="xs" />}
          aria-label={t('Clear')}
          inputSize={size}
        />
      )}
    </FormWrap>
  );
}

const FormWrap = styled('form')`
  display: block;
  position: relative;
`;

const StyledInput = styled(Input)<{showClearButton: boolean}>`
  width: ${p => (p.width ? p.width : undefined)};
  padding-left: ${p => `calc(
    ${p.theme.formPadding[p.size ?? 'md'].paddingLeft}px * 1.5 +
    ${p.theme.iconSizes.sm}
  )`};

  ${p =>
    p.showClearButton &&
    `
      padding-right: calc(
        ${p.theme.formPadding[p.size ?? 'md'].paddingRight}px * 1.5 +
        ${p.theme.iconSizes.xs}
      );
    `}
`;

const StyledIconSearch = styled(IconSearch, {
  shouldForwardProp: prop => typeof prop === 'string' && isPropValid(prop),
})<{inputSize: InputProps['size']}>`
  position: absolute;
  top: 50%;
  left: ${p => p.theme.formPadding[p.inputSize ?? 'md'].paddingLeft}px;
  transform: translateY(-50%);
  pointer-events: none;
`;

const SearchClearButton = styled(Button)<{inputSize: InputProps['size']}>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: ${p => p.theme.formPadding[p.inputSize ?? 'md'].paddingRight}px;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.subText};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default SearchBar;
