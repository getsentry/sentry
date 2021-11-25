import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';

// getsentry will add the view
const DisabledMemberComponent = HookOrDefault({
  hookName: 'component:disabled-member',
  defaultComponent: () => <NotFound />,
});

export default DisabledMemberComponent;
