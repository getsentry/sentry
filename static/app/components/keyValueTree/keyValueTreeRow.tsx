import {Fragment} from 'react';

import {
  TreeBranchIcon,
  TreeKey,
  TreeKeyTrunk,
  TreeSearchKey,
  TreeSpacer,
  TreeValue,
  TreeValueTrunk,
} from 'sentry/components/keyValueTree/styles';
import {KeyValueRow} from 'sentry/components/tables/keyValueTable';

export interface KeyValueTreeRowProps {
  label: React.ReactNode;
  /** Rendered beside the value, e.g. an actions dropdown or error indicators. */
  actions?: React.ReactNode;
  className?: string;
  /** Unabbreviated key, shown on hover and offscreen so browser search still matches it. */
  fullKey?: string;
  hasErrors?: boolean;
  hasStem?: boolean;
  /** Disable when the label renders its own tooltip describing the key. */
  showFullKeyTitle?: boolean;
  spacerCount?: number;
  /** Omitted by trunk rows, which only label the branches nested underneath them. */
  value?: React.ReactNode;
}

export function KeyValueTreeRow({
  actions,
  fullKey,
  hasErrors = false,
  hasStem = false,
  label,
  showFullKeyTitle = true,
  spacerCount = 0,
  value,
  ...props
}: KeyValueTreeRowProps) {
  return (
    <KeyValueRow tone={hasErrors ? 'danger' : undefined} {...props}>
      <TreeKeyTrunk spacerCount={spacerCount}>
        {spacerCount > 0 && (
          <Fragment>
            <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
            <TreeBranchIcon hasErrors={hasErrors} />
          </Fragment>
        )}
        {fullKey && <TreeSearchKey aria-hidden>{fullKey}</TreeSearchKey>}
        <TreeKey hasErrors={hasErrors} title={showFullKeyTitle ? fullKey : undefined}>
          {label}
        </TreeKey>
      </TreeKeyTrunk>
      <TreeValueTrunk>
        {value === undefined ? null : (
          <TreeValue hasErrors={hasErrors}>{value}</TreeValue>
        )}
        {actions}
      </TreeValueTrunk>
    </KeyValueRow>
  );
}
