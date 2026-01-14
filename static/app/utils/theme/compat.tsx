/**
 * Creates a Proxy that allows a token object to be used as both:
 * - An object with nested properties (new interface)
 * - A string value (legacy interface)
 *
 * When coerced to a string, returns the 'vibrant' property.
 */
function createBackwardsCompatibleToken<
  T extends {moderate: string; muted: string; vibrant: string},
>(tokenObj: T): T {
  return new Proxy(tokenObj, {
    get(target, prop, receiver) {
      if (prop === '__emotion_styles') {
        return target.vibrant;
      }
      if (
        prop === 'toString' ||
        prop === 'valueOf' ||
        prop === 'toJSON' ||
        prop === Symbol.toPrimitive
      ) {
        return () => target.vibrant;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export interface LegacyTokens {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  graphics: {
    /**
     * @deprecated Use `graphics.accent.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    accent: string;
    /**
     * @deprecated Use `graphics.danger.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    danger: string;
    /**
     * @deprecated Use `graphics.neutral.moderate` instead
     */
    muted: string;
    /**
     * @deprecated Use `graphics.promotion.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    promotion: string;
    /**
     * @deprecated Use `graphics.success.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    success: string;
    /**
     * @deprecated Use `graphics.warning.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    warning: string;
  };
}

export function withLegacyTokens<T extends Record<string, any>>(
  tokens: T
): T & LegacyTokens {
  const background = {
    ...tokens.background,
  } satisfies LegacyTokens['background'];

  const graphics = {
    ...tokens.graphics,
    muted: tokens.graphics.neutral.vibrant,
    // Apply compatability Proxy to deprecated tokens
    accent: createBackwardsCompatibleToken(tokens.graphics.accent),
    promotion: createBackwardsCompatibleToken(tokens.graphics.promotion),
    danger: createBackwardsCompatibleToken(tokens.graphics.danger),
    warning: createBackwardsCompatibleToken(tokens.graphics.warning),
    success: createBackwardsCompatibleToken(tokens.graphics.success),
  };
  return {
    ...tokens,
    background,
    graphics,
  };
}
