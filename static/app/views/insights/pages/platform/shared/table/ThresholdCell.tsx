import {useTheme} from '@emotion/react';

const getCellColor = (value?: number, thresholds?: Record<string, number>) => {
  if (!value || !thresholds) {
    return undefined;
  }
  return Object.entries(thresholds).find(([_, threshold]) => value >= threshold)?.[0] as
    | 'errorText'
    | 'warningText'
    | undefined;
};

export type CellThreshold = Record<string, number>;

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
  return <div style={{color: color && theme[color]}}>{children}</div>;
}
