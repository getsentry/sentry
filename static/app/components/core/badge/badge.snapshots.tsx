import {Badge, type BadgeProps} from '@sentry/scraps/badge';

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
    variant => (
      <div style={{padding: 8}}>
        <Badge variant={variant}>{variant}</Badge>
      </div>
    ),
    variant => ({tags: {variant: String(variant), area: 'core'}})
  );
});
