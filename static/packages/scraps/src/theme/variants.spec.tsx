import {expectTypeOf} from 'expect-type';

import type {
  AlertVariant,
  BackgroundVariant,
  BorderStyle,
  BorderVariant,
  BorderWidth,
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
    | 'translucent'
    | 'none'
  >();
  expectTypeOf<BorderStyle>().toEqualTypeOf<'solid' | 'dashed'>();
  expectTypeOf<BorderWidth>().toEqualTypeOf<'0' | 'md' | 'lg' | 'xl' | '2xl'>();
  expectTypeOf<BackgroundVariant>().toEqualTypeOf<
    | 'primary'
    | 'secondary'
    | 'tertiary'
    | 'accent'
    | 'danger'
    | 'promotion'
    | 'success'
    | 'warning'
    | 'translucent'
  >();
  expectTypeOf<TagVariant>().toEqualTypeOf<
    'muted' | 'info' | 'success' | 'warning' | 'danger' | 'promotion'
  >();
  expectTypeOf<AlertVariant>().toEqualTypeOf<
    'muted' | 'info' | 'warning' | 'success' | 'danger'
  >();
});
