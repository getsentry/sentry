import {
  GpuHangEventFixture,
  GpuPageFaultEventFixture,
} from 'sentry-fixture/gpuCrashEvent';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {Container} from '@sentry/scraps/layout';

import type {Event} from 'sentry/types/event';
import {OrganizationContext} from 'sentry/utils/organizationContext';

import {EventGpuCrashReport} from './gpuCrashReport';

const organization = OrganizationFixture();

function Report({event}: {event: Event}) {
  return (
    <OrganizationContext value={organization}>
      <Container background="primary" padding="lg">
        <EventGpuCrashReport event={event} />
      </Container>
    </OrganizationContext>
  );
}

describe('EventGpuCrashReport', () => {
  it.snapshot('shader-hang', () => <Report event={GpuHangEventFixture()} />, {
    viewport: 'xl',
  });

  it.snapshot(
    'page-fault',
    () => (
      <Report
        event={GpuPageFaultEventFixture({status: 'partial', missing_dif_count: 2})}
      />
    ),
    {viewport: 'xl'}
  );
});
