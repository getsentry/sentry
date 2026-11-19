import {MemoryRouter} from 'react-router';
import {IconArrow} from '@sentry/icons/arrow';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AnimatePresence} from 'framer-motion';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {Button} from '@sentry/scraps/button';

import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {OrganizationContext} from 'sentry/utils/organizationContext';

import {FirstEventFooter} from './firstEventFooter';
import {FOOTER_HEIGHT} from './genericFooter';

interface WaitingFooterProps {
  organization: Organization;
  project: Project;
}

function WaitingFooter({organization, project}: WaitingFooterProps) {
  return (
    <MemoryRouter>
      <OrganizationContext value={organization}>
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
      </OrganizationContext>
    </MemoryRouter>
  );
}

describe('FirstEventFooter', () => {
  it.snapshot(
    'waiting for error on a phone',
    () => (
      <WaitingFooter
        organization={OrganizationFixture()}
        project={ProjectFixture({firstEvent: null})}
      />
    ),
    {viewport: 390}
  );

  it.snapshot(
    'waiting for error on desktop',
    () => (
      <WaitingFooter
        organization={OrganizationFixture()}
        project={ProjectFixture({firstEvent: null})}
      />
    ),
    {viewport: 1440}
  );
});
