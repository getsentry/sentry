import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';

type Props = {
  disabled?: boolean;
  onChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  query?: string;
};

export default function PreprodBuildsSearchBar({
  onChange,
  onSearch,
  query,
  disabled,
}: Props) {
  return (
    <SearchBar
      placeholder={t('Search by build, SHA, branch name, or pull request')}
      onChange={onChange}
      onSearch={onSearch}
      query={query}
      disabled={disabled}
    />
  );
}
