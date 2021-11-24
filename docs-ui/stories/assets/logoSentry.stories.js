import LogoSentry from 'sentry/components/logoSentry';

export default {
  title: 'Assets/Logo',
  component: LogoSentry,
};

export const Logo = () => (
  <div>
    <LogoSentry />
    <LogoSentry showWordmark={false} />
  </div>
);
