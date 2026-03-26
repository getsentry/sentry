import {NotFound} from 'sentry/components/errors/notFound';
import {HookOrDefault} from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';

// getsentry will add the view
const DisabledMemberComponent = HookOrDefault({
  hookName: 'component:disabled-member',
  defaultComponent: () => (
    <Layout.Page withPadding>
      <NotFound />
    </Layout.Page>
  ),
});

export default DisabledMemberComponent;
