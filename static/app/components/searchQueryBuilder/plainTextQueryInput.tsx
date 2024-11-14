import {
  type ChangeEvent,
  type KeyboardEvent,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {space} from 'sentry/styles/space';

interface PlainTextQueryInputProps {
  label?: string;
}

export function PlainTextQueryInput({label}: PlainTextQueryInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {query, parsedQuery, dispatch, handleSearch, size, placeholder, disabled} =
    useSearchQueryBuilder();
  const [cursorPosition, setCursorPosition] = useState(0);

  const setCursorPositionOnEvent = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    if (event.currentTarget !== document.activeElement) {
      setCursorPosition(-1);
    } else {
      setCursorPosition(event.currentTarget.selectionStart);
    }
  };

  const onChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setCursorPositionOnEvent(e);
      dispatch({type: 'UPDATE_QUERY', query: e.target.value});
    },
    [dispatch]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      setCursorPositionOnEvent(e);

      if (e.key === 'Enter') {
        e.preventDefault();
        handleSearch(query);
      }
    },
    [handleSearch, query]
  );

  return (
    <InputWrapper>
      {parsedQuery ? (
        <Highlight size={size}>
          <HighlightQuery parsedQuery={parsedQuery} cursorPosition={cursorPosition} />
        </Highlight>
      ) : null}
      <InvisibleInput
        aria-label={label}
        ref={inputRef}
        autoComplete="off"
        value={query}
        onFocus={setCursorPositionOnEvent}
        onBlur={setCursorPositionOnEvent}
        onKeyUp={setCursorPositionOnEvent}
        onKeyDown={onKeyDown}
        onChange={onChange}
        onClick={setCursorPositionOnEvent}
        onPaste={setCursorPositionOnEvent}
        spellCheck={false}
        size={size}
        placeholder={placeholder}
        disabled={disabled}
      />
    </InputWrapper>
  );
}

const InputWrapper = styled('div')`
  position: relative;
  width: 100%;
  height: 100%;
`;

const Highlight = styled('div')<{size: 'small' | 'normal'}>`
  padding: ${p =>
    p.size === 'small'
      ? `${space(0.75)} ${space(1)}`
      : `${space(0.75)} 48px ${space(0.75)} 44px`};
  width: 100%;
  height: 100%;
  user-select: none;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 24px;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
`;

const InvisibleInput = styled('textarea')<{size: 'small' | 'normal'}>`
  padding: ${p =>
    p.size === 'small'
      ? `${space(0.75)} ${space(1)}`
      : `${space(0.75)} 48px ${space(0.75)} 44px`};
  position: absolute;
  inset: 0;
  resize: none;
  outline: none;
  border: 0;
  width: 100%;
  line-height: 25px;
  margin-bottom: -1px;
  background: transparent;
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
  caret-color: ${p => p.theme.subText};
  color: transparent;

  &::selection {
    background: rgba(0, 0, 0, 0.2);
  }
  &::placeholder {
    color: ${p => p.theme.formPlaceholder};
  }
  :placeholder-shown {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  [disabled] {
    color: ${p => p.theme.disabled};
  }
`;
