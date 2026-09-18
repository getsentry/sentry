import {Alert, type AlertProps} from '@sentry/scraps/alert';

describe('Alert', () => {
  it.snapshot.each<AlertProps['variant']>([
    'info',
    'warning',
    'success',
    'danger',
    'muted',
  ])(
    '%s',
    variant => (
      <div style={{width: 400}}>
        <Alert variant={variant}>This is a {variant} alert</Alert>
      </div>
    ),
    variant => ({tags: {variant: String(variant), area: 'core'}})
  );

  it.snapshot.each<AlertProps['variant']>([
    'info',
    'warning',
    'success',
    'danger',
    'muted',
  ])(
    '%s-no-icon',
    variant => (
      <div style={{width: 400}}>
        <Alert variant={variant} showIcon={false}>
          This is a {variant} alert without icon
        </Alert>
      </div>
    ),
    variant => ({tags: {variant: String(variant), showIcon: 'false', area: 'core'}})
  );

  it.snapshot.each<AlertProps['variant']>([
    'info',
    'warning',
    'success',
    'danger',
    'muted',
  ])(
    'system-%s',
    variant => (
      <div style={{width: 400}}>
        <Alert variant={variant} system>
          This is a system {variant} alert
        </Alert>
      </div>
    ),
    variant => ({tags: {variant: String(variant), system: 'true', area: 'core'}})
  );
});
