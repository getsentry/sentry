import {Fragment} from 'react';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Container} from 'sentry/components/core/layout';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';

const displaySelectOptions: Array<SelectOption<PreprodBuildsDisplay>> = [
  {value: PreprodBuildsDisplay.SIZE, label: t('Size')},
  {value: PreprodBuildsDisplay.DISTRIBUTION, label: t('Distribution')},
];

type DisplayOptionsProps = {
  onSelect: (display: PreprodBuildsDisplay) => void;
  selected: PreprodBuildsDisplay;
};

type Props = {
  disabled?: boolean;
  displayOptions?: DisplayOptionsProps;
  onChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  query?: string;
};

export default function PreprodBuildsSearchBar({
  onChange,
  onSearch,
  query,
  disabled,
  displayOptions,
}: Props) {
  return (
    <Fragment>
      <Container flex="1">
        <SearchBar
          placeholder={t('Search by build, SHA, branch name, or pull request')}
          onChange={onChange}
          onSearch={onSearch}
          query={query}
          disabled={disabled}
        />
      </Container>
      {displayOptions && (
        <Container maxWidth="200px">
          <CompactSelect
            options={displaySelectOptions}
            value={displayOptions.selected}
            onChange={option => displayOptions.onSelect(option.value)}
            triggerProps={{prefix: t('Display'), style: {width: '100%', zIndex: 1}}}
          />
        </Container>
      )}
    </Fragment>
  );
}
