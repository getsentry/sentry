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
  const icon = generateIconName(name, version);

  const title = (
    <CountTooltipContent>
      <dt>Name:</dt>
      <dd>{name}</dd>
      {version ? <dt>Version:</dt> : null}
      {version ? <dd>{version}</dd> : null}
    </CountTooltipContent>
  );
  return (
    <Tooltip title={title} className={className}>
      <Suspense fallback={<LoadingMask />}>
        <LazyContextIcon name={icon} size="sm" />
      </Suspense>
      {version ? version : null}
    </Tooltip>
  );
})`
  display: flex;
  gap: ${space(1)};
  font-variant-numeric: tabular-nums;
  align-items: center;
`;

const CountTooltipContent = styled('dl')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)} ${space(3)};
  text-align: left;
  align-items: center;
  margin-bottom: 0;
`;

export default ContextIcon;
