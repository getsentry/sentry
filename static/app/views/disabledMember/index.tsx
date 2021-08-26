import NotFound from 'app/components/errors/notFound';
import HookOrDefault from 'app/components/hookOrDefault';

// getsentry will add the view
const DisabledMemberComponent = HookOrDefault({
  hookName: 'component:disabled-member',
  defaultComponent: () => <NotFound />,
});

export default DisabledMemberComponent;
