import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const ToolbarSection = styled('div')`
  margin-bottom: ${space(2)};
`;

export const ToolbarHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
`;

export const ToolbarHeading = styled('h6')<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  line-height: ${p => p.theme.form.md.lineHeight};
  text-decoration: underline dotted
    ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
  margin: 0 0 ${space(1)} 0;
`;

export const ToolbarHeaderButton = styled(Button)<{disabled?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.purple300)};
`;

export function ToolbarRow<T>({
  index = 0,
  rows = [],
  setRows,
  children,
}: {
  children: React.ReactNode;
  index?: number;
  rows?: T[];
  setRows?: (rows: T[]) => void;
}) {
  const removeRow = useCallback(
    (i: number) => {
      const newRow = rows.filter((_, rowIndex) => rowIndex !== i);
      setRows?.(newRow);
    },
    [setRows, rows]
  );

  return (
    <ToolbarRowWrapper>
      {children}
      <Button
        borderless
        icon={<IconDelete />}
        size="zero"
        disabled={rows.length <= 1}
        onClick={e => {
          e.preventDefault();
          removeRow(index);
        }}
        aria-label={t('Remove')}
      />
    </ToolbarRowWrapper>
  );
}

const ToolbarRowWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
