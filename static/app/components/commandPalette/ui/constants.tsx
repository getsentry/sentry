import type {CommandPaletteGroupKey} from 'sentry/components/commandPalette/types';
import {t} from 'sentry/locale';

export const COMMAND_PALETTE_GROUP_KEY_CONFIG: Record<
  CommandPaletteGroupKey,
  {
    label: string;
  }
> = {
  'search-result': {
    label: t('Search Results'),
  },
  navigate: {
    label: t('Go to…'),
  },
  add: {
    label: t('Add'),
  },
  help: {
    label: t('Help'),
  },
};
