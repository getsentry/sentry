import {IconArrow} from '@sentry/icons/arrow';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AnimatePresence} from 'framer-motion';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {Button} from '@sentry/scraps/button';

import {FirstEventFooter} from './firstEventFooter';
import {FOOTER_HEIGHT} from './genericFooter';

// SSR snapshot tests — no jsdom/RTL/router, so we mock hooks directly.
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => () => {},
}));
// oxlint-disable-next-line @sentry/scraps/no-restricted-module-mocks
jest.mock('sentry/utils/useOrganization', () => ({
  useOrganization: () => OrganizationFixture(),
}));

const organization = OrganizationFixture();
const project = ProjectFixture({firstEvent: null});

function WaitingFooter() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {/* The footer is position: fixed. A transformed ancestor becomes its
          containing block, so the capture gets a real height. */}
      <div style={{height: FOOTER_HEIGHT, transform: 'translateZ(0)'}}>
        {/* SSR renders a motion element's initial state, which is transparent. */}
        <AnimatePresence initial={false}>
          <FirstEventFooter
            organization={organization}
            project={project}
            isLast
            onClickSetupLater={() => {}}
            leading={
              <Button icon={<IconArrow direction="left" />} variant="transparent">
                Back
              </Button>
            }
          />
        </AnimatePresence>
      </div>
    </QueryClientProvider>
  );
}

describe('FirstEventFooter', () => {
  it.snapshot('waiting for error on a phone', () => <WaitingFooter />, {viewport: 390});

  it.snapshot('waiting for error on desktop', () => <WaitingFooter />, {viewport: 1440});
});
