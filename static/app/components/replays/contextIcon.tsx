import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

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

const ICON_SIZE = commonTheme.iconSizes.md;

const ContextIcon = styled(
  ({className, name, version, showVersion, showTooltip}: Props) => {
    const icon = generatePlatformIconName(name, version);

    if (!showTooltip) {
      return <PlatformIcon platform={icon} size={ICON_SIZE} />;
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
        <PlatformIcon platform={icon} size={ICON_SIZE} />
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
