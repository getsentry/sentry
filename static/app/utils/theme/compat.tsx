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
      if (prop === 'toString' || prop === 'valueOf' || prop === Symbol.toPrimitive) {
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
  border: {
    /**
     * @deprecated Use `border.accent.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    accent: string;
    /**
     * @deprecated Use `border.danger.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    danger: string;
    /**
     * @deprecated Use `border.secondary` instead
     */
    muted: string;
    primary: string;
    /**
     * @deprecated Use `border.promotion.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    promotion: string;
    /**
     * @deprecated Use `border.success.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    success: string;
    /**
     * @deprecated Use `border.warning.vibrant` for the same color, or access `.muted`, `.moderate`, or `.vibrant` variants
     */
    warning: string;
  };
  component: {
    link: {
      accent: {
        active: string;
        default: string;
        hover: string;
      };
      /**
       * @deprecated Use `interactive.link.neutral` instead (with `.rest`, `.hover`, `.active` properties)
       */
      muted: {
        active: string;
        default: string;
        hover: string;
      };
    };
  };
  content: {
    accent: string;
    danger: string;
    /**
     * @deprecated Use `content.secondary` instead
     */
    muted: string;
    primary: string;
    promotion: string;
    success: string;
    warning: string;
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
  const border = {
    ...tokens.border,
    muted: tokens.border.secondary,

    // Apply Proxy to semantic color tokens
    accent: createBackwardsCompatibleToken(tokens.border.accent),
    promotion: createBackwardsCompatibleToken(tokens.border.promotion),
    danger: createBackwardsCompatibleToken(tokens.border.danger),
    warning: createBackwardsCompatibleToken(tokens.border.warning),
    success: createBackwardsCompatibleToken(tokens.border.success),
  };

  const content = {
    ...tokens.content,
    muted: tokens.content.secondary,
  } satisfies LegacyTokens['content'];
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
  const component = {
    link: {
      muted: {
        default: tokens.interactive.link.neutral.rest,
        hover: tokens.interactive.link.neutral.hover,
        active: tokens.interactive.link.neutral.active,
      },
      accent: {
        default: tokens.interactive.link.accent.rest,
        hover: tokens.interactive.link.accent.hover,
        active: tokens.interactive.link.accent.active,
      },
    },
  } satisfies LegacyTokens['component'];
  return {
    ...tokens,
    background,
    border,
    content,
    graphics,
    component,
  };
}
