import styled from '@emotion/styled';
import {PlatformIcon as BasePlatformIcon} from 'platformicons';

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

const iconSize = '16px';
const iconStyle = {
  border: '1px solid ' + commonTheme.translucentGray100,
};

const PlatformIcon = styled(
  ({className, name, version, showVersion, showTooltip}: Props) => {
    const icon = generatePlatformIconName(name, version);

    if (!showTooltip) {
      return <BasePlatformIcon platform={icon} size={iconSize} style={iconStyle} />;
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
        <BasePlatformIcon platform={icon} size={iconSize} style={iconStyle} />
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

export default PlatformIcon;
