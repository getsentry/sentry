import type {
  SelectOptionWithKey,
  SelectSectionWithKey,
} from 'sentry/components/compactSelect/types';

export interface KeyItem extends SelectOptionWithKey<string> {
  description: string;
  details: React.ReactNode;
  hideCheck: boolean;
  showDetailsInOverlay: boolean;
  textValue: string;
  value: string;
}

export interface KeySectionItem extends SelectSectionWithKey<string> {
  options: KeyItem[];
  value: string;
}
