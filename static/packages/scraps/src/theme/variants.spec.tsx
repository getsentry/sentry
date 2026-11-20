import {expectTypeOf} from 'expect-type';

import type {
  AlertVariant,
  BorderToken,
  BorderVariant,
  ButtonVariant,
  ContentVariant,
  GraphicsVariant,
  SurfaceVariant,
  TagVariant,
} from '@sentry/scraps/theme';
import type {useClickTracking} from '@sentry/scraps/trackingContext';

it('preserves the variant unions and constrains tracked button variants', () => {
  expectTypeOf<ButtonVariant>().toEqualTypeOf<
    'secondary' | 'primary' | 'danger' | 'warning' | 'link' | 'transparent'
  >();
  expectTypeOf<Parameters<typeof useClickTracking>[0]['variant']>().toEqualTypeOf<
    ButtonVariant | undefined
  >();
  expectTypeOf<SurfaceVariant>().toEqualTypeOf<'primary' | 'secondary' | 'tertiary'>();
  expectTypeOf<ContentVariant>().toEqualTypeOf<
    'accent' | 'danger' | 'promotion' | 'success' | 'warning' | 'primary' | 'secondary'
  >();
  expectTypeOf<GraphicsVariant>().toEqualTypeOf<
    'accent' | 'danger' | 'neutral' | 'promotion' | 'success' | 'warning'
  >();
  expectTypeOf<BorderToken>().toEqualTypeOf<
    | 'primary'
    | 'secondary'
    | 'neutral.muted'
    | 'neutral.moderate'
    | 'neutral.vibrant'
    | 'accent.muted'
    | 'accent.moderate'
    | 'accent.vibrant'
    | 'promotion.muted'
    | 'promotion.moderate'
    | 'promotion.vibrant'
    | 'danger.muted'
    | 'danger.moderate'
    | 'danger.vibrant'
    | 'warning.muted'
    | 'warning.moderate'
    | 'warning.vibrant'
    | 'success.muted'
    | 'success.moderate'
    | 'success.vibrant'
    | 'onVibrant.light'
    | 'onVibrant.dark'
    | 'transparent.neutral.muted'
    | 'transparent.neutral.moderate'
    | 'transparent.neutral.vibrant'
    | 'transparent.accent.muted'
    | 'transparent.accent.moderate'
    | 'transparent.accent.vibrant'
    | 'transparent.promotion.muted'
    | 'transparent.promotion.moderate'
    | 'transparent.promotion.vibrant'
    | 'transparent.danger.muted'
    | 'transparent.danger.moderate'
    | 'transparent.danger.vibrant'
    | 'transparent.warning.muted'
    | 'transparent.warning.moderate'
    | 'transparent.warning.vibrant'
    | 'transparent.success.muted'
    | 'transparent.success.moderate'
    | 'transparent.success.vibrant'
  >();
  expectTypeOf<BorderVariant>().toEqualTypeOf<
    | BorderToken
    | 'accent'
    | 'danger'
    | 'promotion'
    | 'success'
    | 'warning'
    | 'muted'
    | 'none'
  >();
  expectTypeOf<TagVariant>().toEqualTypeOf<
    'muted' | 'info' | 'success' | 'warning' | 'danger' | 'promotion'
  >();
  expectTypeOf<AlertVariant>().toEqualTypeOf<
    'muted' | 'info' | 'warning' | 'success' | 'danger'
  >();
});
