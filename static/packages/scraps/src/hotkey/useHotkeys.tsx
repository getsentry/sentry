import {
  useHotkeys as useTanStackHotkeys,
  type UseHotkeyCommonOptions,
  type UseHotkeyDefinition,
} from '@tanstack/react-hotkeys';

/** Register native TanStack hotkeys with Sentry's input and propagation defaults. */
export function useHotkeys(
  hotkeys: readonly UseHotkeyDefinition[],
  options?: UseHotkeyCommonOptions
): void {
  useTanStackHotkeys(hotkeys, {
    ignoreInputs: true,
    stopPropagation: false,
    conflictBehavior: 'allow',
    ...options,
  });
}
