import {expectTypeOf} from 'expect-type';

import type {ContentVariant as ThemeContentVariant} from '@sentry/scraps/theme';
import type {useClickTracking} from '@sentry/scraps/trackingContext';
import type {
  AlertVariant,
  BorderVariant,
  ButtonVariant,
  ContentVariant,
  GraphicsVariant,
  SurfaceVariant,
  TagVariant,
} from '@sentry/scraps/variants';

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
  expectTypeOf<ThemeContentVariant>().toEqualTypeOf<ContentVariant>();
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
  expectTypeOf<TagVariant>().toEqualTypeOf<
    'muted' | 'info' | 'success' | 'warning' | 'danger' | 'promotion'
  >();
  expectTypeOf<AlertVariant>().toEqualTypeOf<
    'muted' | 'info' | 'warning' | 'success' | 'danger'
  >();
});
