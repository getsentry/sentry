import {useTheme} from '@emotion/react';

const getCellColor = (
  value?: number,
  thresholds?: Record<'danger' | 'warning', number>
) => {
  if (!value || !thresholds) {
    return undefined;
  }
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0] as
    | 'danger'
    | 'warning'
    | undefined;
};

export type CellThreshold = Record<'danger' | 'warning', number>;

export function ThresholdCell({
  value,
  thresholds,
  children,
}: {
  children: React.ReactNode;
  thresholds?: Record<string, number>;
  value?: number;
}) {
  const theme = useTheme();
  const color = getCellColor(value, thresholds);
  return (
    <div
      style={{
        color:
          color === 'danger'
            ? theme.tokens.content.danger
            : color === 'warning'
              ? theme.tokens.content.warning
              : undefined,
      }}
    >
      {children}
    </div>
  );
}
