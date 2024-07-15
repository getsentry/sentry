import {lazy, Suspense} from 'react';
import styled from '@emotion/styled';

import LoadingMask from 'sentry/components/loadingMask';
import CountTooltipContent from 'sentry/components/replays/countTooltipContent';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {generatePlatformIconName} from 'sentry/utils/replays/generatePlatformIconName';
import commonTheme from 'sentry/utils/theme';

type Props = {
  name: string;
  version: undefined | string;
  className?: string;
  showTooltip?: boolean;
  showVersion?: boolean;
};

async function loadPlatformIcon() {
  const platformiconsModule = await import('platformicons');
  return {default: platformiconsModule.PlatformIcon};
}

const LazyPlatformIcon = lazy(() => loadPlatformIcon());

const ICON_SIZE = commonTheme.iconSizes.md;

const ContextIcon = styled(
  ({className, name, version, showVersion, showTooltip}: Props) => {
    const icon = generatePlatformIconName(name, version);

    if (!showTooltip) {
      return (
        <Suspense fallback={<LoadingMask />}>
          <LazyPlatformIcon platform={icon} size={ICON_SIZE} />
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
          <LazyPlatformIcon platform={icon} size={ICON_SIZE} />
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
