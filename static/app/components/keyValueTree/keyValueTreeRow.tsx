import {Fragment} from 'react';
import classNames from 'classnames';

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
  hasErrors?: boolean;
  hasStem?: boolean;
  labelTestId?: string;
  labelTitle?: string;
  /** Unabbreviated key, rendered offscreen so browser search still matches it. */
  searchKey?: string;
  spacerCount?: number;
  /** Omitted by trunk rows, which only label the branches nested underneath them. */
  value?: React.ReactNode;
}

export function KeyValueTreeRow({
  actions,
  hasErrors = false,
  hasStem = false,
  label,
  labelTestId,
  labelTitle,
  searchKey,
  spacerCount = 0,
  value,
  ...props
}: KeyValueTreeRowProps) {
  const keyTrunk = (
    <TreeKeyTrunk spacerCount={spacerCount}>
      {spacerCount > 0 && (
        <Fragment>
          <TreeSpacer spacerCount={spacerCount} hasStem={hasStem} />
          <TreeBranchIcon hasErrors={hasErrors} />
        </Fragment>
      )}
      {searchKey === undefined ? null : (
        <TreeSearchKey aria-hidden>{searchKey}</TreeSearchKey>
      )}
      <TreeKey hasErrors={hasErrors} title={labelTitle} data-test-id={labelTestId}>
        {label}
      </TreeKey>
    </TreeKeyTrunk>
  );

  if (value === undefined) {
    return (
      <TreeRow hasErrors={hasErrors} {...props}>
        {keyTrunk}
        <TreeValueTrunk />
      </TreeRow>
    );
  }

  return (
    <RevealOnHover>
      {revealOnHoverProps => (
        <TreeRow
          hasErrors={hasErrors}
          {...props}
          className={classNames(props.className, revealOnHoverProps.className)}
        >
          {keyTrunk}
          <TreeValueTrunk>
            <TreeValue hasErrors={hasErrors}>{value}</TreeValue>
            {actions}
          </TreeValueTrunk>
        </TreeRow>
      )}
    </RevealOnHover>
  );
}
