import {AnnotationFixture} from 'sentry-fixture/annotation';

import {
  render,
  screen,
  userEvent,
  waitForDrawerToHide,
} from 'sentry-test/reactTestingLibrary';

import {useDroppedDataDrawer} from 'sentry/components/droppedData/useDroppedDataDrawer';
import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

const droppedAnnotations = [AnnotationFixture({eventCount: 10})];
const acceptedAnnotations = [AnnotationFixture({outcome: 'accepted', eventCount: 90})];

function DroppedDataTrigger({
  dropped,
  accepted,
}: {
  accepted?: Annotation[];
  dropped?: Annotation[];
}) {
  const openDroppedDataDrawer = useDroppedDataDrawer(dropped, accepted);
  return <button onClick={openDroppedDataDrawer}>Open dropped data</button>;
}

describe('useDroppedDataDrawer', () => {
  it('stays open and refreshes when zooming changes the time range', async () => {
    const {router, rerender} = render(
      <DroppedDataTrigger dropped={droppedAnnotations} accepted={acceptedAnnotations} />,
      {initialRouterConfig: {location: {pathname: '/explore/traces/'}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    router.navigate('/explore/traces/?start=2024-01-01T00:00:00&end=2024-01-01T01:00:00');
    rerender(
      <DroppedDataTrigger
        dropped={[AnnotationFixture({eventCount: 3})]}
        accepted={acceptedAnnotations}
      />
    );

    expect(await screen.findByText('3 Dropped Events')).toBeInTheDocument();
  });

  it('closes when navigating to another page', async () => {
    const {router} = render(
      <DroppedDataTrigger dropped={droppedAnnotations} accepted={acceptedAnnotations} />,
      {initialRouterConfig: {location: {pathname: '/explore/traces/'}}}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(await screen.findByText('10 Dropped Events')).toBeInTheDocument();

    router.navigate('/issues/');
    await waitForDrawerToHide('Dropped Data');
  });

  it('does not open without dropped annotations', async () => {
    render(<DroppedDataTrigger dropped={[]} accepted={acceptedAnnotations} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open dropped data'}));
    expect(screen.queryByText(/Dropped Events/)).not.toBeInTheDocument();
  });
});
