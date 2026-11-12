import {Tooltip, type TooltipProps} from '@sentry/scraps/tooltip';

import {useSearchQueryBuilderConfig} from 'sentry/components/searchQueryBuilder/context';
import {KeyDetails} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';

interface FilterKeyDetailsTooltipProps extends Pick<
  TooltipProps,
  'children' | 'skipWrapper'
> {
  keyName: string;
}

export function FilterKeyDetailsTooltip({
  children,
  keyName,
  skipWrapper,
}: FilterKeyDetailsTooltipProps) {
  const {filterKeys, getFieldDefinition} = useSearchQueryBuilderConfig();
  const filterKey = Object.hasOwn(filterKeys, keyName) ? filterKeys[keyName] : undefined;
  const tag =
    filterKey ??
    (getFieldDefinition(keyName) ? {key: keyName, name: keyName} : undefined);

  return (
    <Tooltip title={tag ? <KeyDetails tag={tag} /> : undefined} skipWrapper={skipWrapper}>
      {children}
    </Tooltip>
  );
}
