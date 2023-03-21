import {lazy, Suspense} from 'react';
import styled from '@emotion/styled';

import {generateIconName} from 'sentry/components/events/contextSummary/utils';
import LoadingMask from 'sentry/components/loadingMask';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';

type Props = {
  name: string;
  version: undefined | string;
  className?: string;
};

const LazyContextIcon = lazy(
  () => import('sentry/components/events/contextSummary/contextIcon')
);

const ContextIcon = styled(({className, name, version}: Props) => {
  const icon = generateIconName(name, version ?? undefined);
  return (
    <div className={className}>
      <Tooltip title={name}>
        <Suspense fallback={<LoadingMask />}>
          <LazyContextIcon name={icon} size="sm" />
        </Suspense>
      </Tooltip>
      {version ? <div>{version}</div> : null}
    </div>
  );
})`
  display: flex;
  gap: ${space(1)};
  font-variant-numeric: tabular-nums;
`;

export default ContextIcon;
