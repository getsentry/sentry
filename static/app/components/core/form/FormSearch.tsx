import type {ReactNode} from 'react';

interface FormSearchProps {
  children: ReactNode;
  /**
   * Route pattern for SettingsSearch (e.g., '/settings/account/details/').
   * This prop is used by the static extraction script to associate
   * form fields with their navigation route. It has no runtime effect.
   */
  route: string;
}

/**
 * Wrapper component that marks form fields as searchable in SettingsSearch.
 * The `route` prop is extracted at build time by scripts/extractFormFields.ts
 * to generate the form field registry used for search.
 *
 * This component has no runtime behavior - it simply renders its children.
 */
export function FormSearch({children}: FormSearchProps) {
  return children;
}
