import {EventFixture} from 'sentry-fixture/event';
import {
  GpuHangEventFixture,
  GpuPageFaultEventFixture,
} from 'sentry-fixture/gpuCrashEvent';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BreadcrumbLevelType, BreadcrumbType} from 'sentry/types/breadcrumbs';
import {EntryType, type EntryBreadcrumbs} from 'sentry/types/event';

import {EventGpuCrashReport} from './gpuCrashReport';

describe('EventGpuCrashReport', () => {
  it('renders nothing unless the exception mechanism is a GPU crash', () => {
    render(
      <EventGpuCrashReport
        event={EventFixture({contexts: GpuHangEventFixture().contexts})}
      />
    );

    expect(screen.queryByText('GPU Crash Report')).not.toBeInTheDocument();
  });

  it('explains a shader hang with its pipeline stage, recovery and GPU markers', async () => {
    render(<EventGpuCrashReport event={GpuHangEventFixture()} />);

    expect(
      screen.getByText(
        'The GPU stopped responding while running the vertex shader vertex_01, so the operating system reset it.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Timeout / TDR')).toBeInTheDocument();
    expect(screen.getAllByText('Draw Triangle')).toHaveLength(2);
    expect(
      screen.getByText('D3D12HelloNsightAftermath.exe @ 0x7ff63915997a')
    ).toBeInTheDocument();
    expect(screen.getByText('Engine State: Rendering.')).toBeInTheDocument();
    expect(screen.queryByText('Faulting address')).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('VS'));
    expect(await screen.findByText('Faulted in this stage')).toBeInTheDocument();
    expect(
      screen.getByText('shader 59339c1ea8934740 · PC 0x00000330 · 1 warps')
    ).toBeInTheDocument();
  });

  it('describes the executing marker when the operation name repeats', () => {
    const event = GpuHangEventFixture();
    event.entries
      .find((entry): entry is EntryBreadcrumbs => entry.type === EntryType.BREADCRUMBS)
      ?.data.values.unshift({
        type: BreadcrumbType.INFO,
        level: BreadcrumbLevelType.INFO,
        category: 'gpu.marker',
        message: 'Draw Triangle',
        data: {Pipe: 'Top', Status: 'Finished', Type: 'User'},
      });

    render(<EventGpuCrashReport event={event} />);

    expect(
      screen.getByText('Executing · Bottom of pipe · User marker')
    ).toBeInTheDocument();
  });

  it('uses singular copy for one missing shader debug file', () => {
    render(<EventGpuCrashReport event={GpuHangEventFixture({missing_dif_count: 1})} />);

    expect(
      screen.getByText(
        /1 shader debug info file \(\.nvdbg\) referenced by this crash was/
      )
    ).toBeInTheDocument();
  });

  it('shows the page fault, faulted warp, compute lane and Unreal build', () => {
    render(
      <EventGpuCrashReport
        event={GpuPageFaultEventFixture({status: 'partial', missing_dif_count: 2})}
      />
    );

    expect(
      screen.getByText(
        'The GPU faulted on a read of 0x0000021443ea0000 while running the compute shader compute_01.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Faulting address')).toBeInTheDocument();
    expect(screen.getByText('compute_01 @ 0x000018c0')).toBeInTheDocument();
    expect(screen.getByText('CS')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Partial decode')).toBeInTheDocument();
    expect(
      screen.getByText(/2 shader debug info files \(\.nvdbg\) referenced by this crash/)
    ).toBeInTheDocument();
  });
});
