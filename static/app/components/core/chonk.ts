import type {Theme} from 'sentry/utils/theme';

export function debossedBackground(theme: Theme) {
  return {
    backgroundColor: theme.type === 'dark' ? 'rgba(8,0,24,0.28)' : 'rgba(0,0,112,0.03)',
  };
}
