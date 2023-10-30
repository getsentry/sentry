import {lazy, Suspense} from 'react';
import styled from '@emotion/styled';

import {generateIconName} from 'sentry/components/events/contextSummary/utils';
import LoadingMask from 'sentry/components/loadingMask';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  name: string;
  version: undefined | string;
  className?: string;
  showTooltip?: boolean;
  showVersion?: boolean;
};

const LazyContextIcon = lazy(
  () => import('sentry/components/events/contextSummary/contextIcon')
);

const ContextIcon = styled(
  ({className, name, version, showVersion, showTooltip}: Props) => {
    const icon = generateIconName(name, version);

    if (!showTooltip) {
      return (
        <Suspense fallback={<LoadingMask />}>
          <LazyContextIcon name={icon} size="sm" />
        </Suspense>
      );
    }

    const title = (
      <CountTooltipContent>
        <dt>{t('Name:')}</dt>
        <dd>{name}</dd>
        {version ? <dt>{t('Version:')}</dt> : null}
        {version ? <dd>{version}</dd> : null}
      </CountTooltipContent>
    );
    return (
      <Tooltip title={title} className={className}>
        <Suspense fallback={<LoadingMask />}>
          <LazyContextIcon name={icon} size="sm" />
        </Suspense>
        {showVersion ? (version ? version : null) : undefined}
      </Tooltip>
    );
  }
)`
  display: flex;
  gap: ${space(1)};
  font-variant-numeric: tabular-nums;
  align-items: center;
`;

export default ContextIcon;
