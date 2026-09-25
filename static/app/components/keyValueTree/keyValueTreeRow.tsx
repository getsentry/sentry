import {Fragment} from 'react';
import {mergeProps} from '@react-aria/utils';

import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {
  TreeBranchIcon,
  TreeKey,
  TreeKeyTrunk,
  TreeRow,
  TreeSearchKey,
  TreeSpacer,
  TreeValue,
  TreeValueTrunk,
} from 'sentry/components/keyValueTree/styles';

export interface KeyValueTreeRowProps {
  label: React.ReactNode;
  /** Rendered beside the value, e.g. an actions dropdown or error indicators. */
  actions?: React.ReactNode;
  className?: string;
  /** Unabbreviated key, shown on hover and offscreen so browser search still matches it. */
  fullKey?: string;
  hasErrors?: boolean;
  hasStem?: boolean;
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
  spacerCount = 0,
  value,
  ...props
}: KeyValueTreeRowProps) {
  return (
    <RevealOnHover>
      {revealOnHoverProps => (
        <TreeRow hasErrors={hasErrors} {...mergeProps(props, revealOnHoverProps)}>
          <TreeKeyTrunk spacerCount={spacerCount}>
            {spacerCount > 0 && (
              <Fragment>
                <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
                <TreeBranchIcon hasErrors={hasErrors} />
              </Fragment>
            )}
            {fullKey && <TreeSearchKey aria-hidden>{fullKey}</TreeSearchKey>}
            <TreeKey hasErrors={hasErrors} title={fullKey}>
              {label}
            </TreeKey>
          </TreeKeyTrunk>
          <TreeValueTrunk>
            {value === undefined ? null : (
              <TreeValue hasErrors={hasErrors}>{value}</TreeValue>
            )}
            {actions}
          </TreeValueTrunk>
        </TreeRow>
      )}
    </RevealOnHover>
  );
}
