import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {generateIconName} from 'sentry/components/events/contexts/utils';
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

// theme.tsx/iconSizes["sm"] + 4, to make up for padding
const iconSize = '18px';

const ContextIcon = styled(
  ({className, name, version, showVersion, showTooltip}: Props) => {
    const icon = generateIconName(name, version);

    if (!showTooltip) {
      return <PlatformIcon platform={icon} size={iconSize} />;
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
        <PlatformIcon platform={icon} size={iconSize} />
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
