import {expectTypeOf} from 'expect-type';

import type {
  AlertVariant,
  BackgroundToken,
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
  expectTypeOf<BorderVariant>().toEqualTypeOf<
    | 'accent'
    | 'danger'
    | 'promotion'
    | 'success'
    | 'warning'
    | 'primary'
    | 'secondary'
    | 'muted'
    | 'none'
  >();
  expectTypeOf<BackgroundToken>().toEqualTypeOf<
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'overlay'
    | 'accent.vibrant'
    | 'promotion.vibrant'
    | 'danger.vibrant'
    | 'warning.vibrant'
    | 'success.vibrant'
    | 'transparent.neutral.muted'
    | 'transparent.accent.muted'
    | 'transparent.promotion.muted'
    | 'transparent.danger.muted'
    | 'transparent.warning.muted'
    | 'transparent.success.muted'
  >();
  expectTypeOf<TagVariant>().toEqualTypeOf<
    'muted' | 'info' | 'success' | 'warning' | 'danger' | 'promotion'
  >();
  expectTypeOf<AlertVariant>().toEqualTypeOf<
    'muted' | 'info' | 'warning' | 'success' | 'danger'
  >();
});
