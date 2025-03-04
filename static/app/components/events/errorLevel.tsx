import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Level} from 'sentry/types/event';
import {capitalize} from 'sentry/utils/string/capitalize';
import useOrganization from 'sentry/utils/useOrganization';

const DEFAULT_SIZE = 13;

type Props = {
  className?: string;
  level?: Level;
  size?: number;
};

function ErrorLevel({className, level = 'unknown', size = 11}: Props) {
  const organization = useOrganization({allowNull: true});
  const hasNewIssueStreamTableLayout = organization?.features.includes(
    'issue-stream-table-layout'
  );

  const levelLabel = t('Level: %s', capitalize(level));
  return (
    <Tooltip skipWrapper disabled={level === 'unknown'} title={levelLabel}>
      {hasNewIssueStreamTableLayout ? (
        <ColoredLine className={className} level={level} size={size}>
          <VisuallyHidden>{levelLabel}</VisuallyHidden>
        </ColoredLine>
      ) : (
        <ColoredCircle className={className} level={level} size={size}>
          {levelLabel}
        </ColoredCircle>
      )}
    </Tooltip>
  );
}

const ColoredLine = styled('span')<Props>`
  padding: 0;
  position: relative;
  width: 3px;
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
  height: 1em;
  background-color: ${p => (p.level ? p.theme.level[p.level] : p.theme.level.error)};
`;

const ColoredCircle = styled('span')<Props>`
  padding: 0;
  position: relative;
  width: ${p => p.size || DEFAULT_SIZE}px;
  height: ${p => p.size || DEFAULT_SIZE}px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => (p.level ? p.theme.level[p.level] : p.theme.level.error)};
`;

export default ErrorLevel;
