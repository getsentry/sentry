import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const DiffHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.2;
  justify-content: space-between;

  & > *:first-child {
    color: ${p => p.theme.red300};
  }

  & > *:last-child {
    color: ${p => p.theme.green300};
  }
`;

const Label = styled('div')`
  display: flex;
  align-items: center;
  font-weight: bold;
`;

export function Before({children}: {children?: React.ReactNode}) {
  return (
    <Tooltip title={t('How the initial server-rendered page looked.')}>
      <Label>
        {t('Before')}
        {children}
      </Label>
    </Tooltip>
  );
}
export function After({children}: {children?: React.ReactNode}) {
  return (
    <Tooltip
      title={t(
        'How React re-rendered the page on your browser, after detecting a hydration error.'
      )}
    >
      <Label>
        {t('After')}
        {children}
      </Label>
    </Tooltip>
  );
}
