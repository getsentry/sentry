import {NotFound} from 'sentry/components/errors/notFound';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';

// getsentry will add the view
const DisabledMemberComponent = OverrideOrDefault({
  overrideName: 'component:disabled-member',
  defaultComponent: () => <NotFound />,
});

export default DisabledMemberComponent;
