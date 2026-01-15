export interface LegacyTokens {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
}

export function withLegacyTokens<T extends Record<string, any>>(
  tokens: T
): T & LegacyTokens {
  const background = {
    ...tokens.background,
  } satisfies LegacyTokens['background'];

  return {
    ...tokens,
    background,
  };
}
