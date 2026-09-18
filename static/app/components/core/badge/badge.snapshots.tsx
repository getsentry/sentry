// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import to avoid barrel re-exports with heavy deps
import {Badge, type BadgeProps} from 'sentry/components/core/badge/badge';

describe('Badge', () => {
  it.snapshot.each<BadgeProps['variant']>([
    'muted',
    'internal',
    'info',
    'success',
    'warning',
    'danger',
    'highlight',
    'promotion',
    'alpha',
    'beta',
    'new',
    'experimental',
  ])(
    '%s',
    variant => <Badge variant={variant}>{variant}</Badge>,
    variant => ({tags: {variant: String(variant), area: 'core'}})
  );
});
