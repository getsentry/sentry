export interface DateTimeConfigSource {
  getClockDisplay: () => '12' | '24';
  getTimezone: () => string;
  subscribe?: (onChange: () => void) => () => void;
}

let source: DateTimeConfigSource = {
  getTimezone: () => 'UTC',
  getClockDisplay: () => '12',
};

/** Configure application defaults before rendering. Providers can override them locally. */
export function configureDateTime(next: DateTimeConfigSource): () => void {
  const previous = source;
  source = next;
  return () => {
    source = previous;
  };
}

export const getTimezone = () => source.getTimezone();
export const getClockDisplay = () => source.getClockDisplay();
export const subscribe = (onChange: () => void) =>
  source.subscribe?.(onChange) ?? (() => {});
