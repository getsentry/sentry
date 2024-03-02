import {Fragment} from 'react';
import styled from '@emotion/styled';

import SearchBar, {SearchBarTrailingButton} from 'sentry/components/searchBar';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface TraceSearchInputProps {
  onChange: (query: string) => void;
  onKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
  onNextSearchClick: () => void;
  onPreviousSearchClick: () => void;
  query: string | undefined;
  resultCount: number | undefined;
  resultIteratorIndex: number | undefined;
}

export function TraceSearchInput(props: TraceSearchInputProps) {
  return (
    <StyledSearchBar
      size="xs"
      placeholder={t('Search in trace')}
      defaultQuery={props.query}
      onChange={props.onChange}
      onKeyDown={props.onKeyDown}
      trailing={
        <Fragment>
          <StyledTrailingText>
            {`${
              props.resultIteratorIndex !== undefined
                ? props.resultIteratorIndex + 1
                : '-'
            }/${props.resultCount ?? 0}`}
          </StyledTrailingText>
          <StyledSearchBarTrailingButton
            size="zero"
            borderless
            icon={<IconChevron size="xs" />}
            aria-label={t('Next')}
            onClick={props.onPreviousSearchClick}
          />
          <StyledSearchBarTrailingButton
            size="zero"
            borderless
            icon={<IconChevron size="xs" direction="down" />}
            aria-label={t('Previous')}
            onClick={props.onNextSearchClick}
          />
        </Fragment>
      }
    />
  );
}

const StyledSearchBarTrailingButton = styled(SearchBarTrailingButton)`
  padding: 0;
`;

const StyledTrailingText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledSearchBar = styled(SearchBar)`
  flex: 1 1 100%;
  margin-bottom: ${space(1)};

  > div > div:last-child {
    gap: ${space(0.25)};
  }
`;
