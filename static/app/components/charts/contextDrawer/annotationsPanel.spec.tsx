import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';

import {AnnotationsPanel} from './annotationsPanel';

const release: AnnotationItem = {
  id: 'release:1.0.0',
  kind: 'release',
  start: 0,
  title: '1.0.0',
};

function change(id: string, pinned: boolean): AnnotationItem {
  return {id, kind: 'timeseriesAnnotation', start: 0, title: id, pinned};
}

describe('AnnotationsPanel', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({url: '/organizations/org-slug/releases/', body: []});
  });

  it('lists pinned items under Pinned and the rest under their kind', () => {
    render(
      <AnnotationsPanel
        items={[change('outage', true), change('sdk-update', false)]}
        kinds={['timeseriesAnnotation']}
      />
    );

    expect(
      within(screen.getByRole('region', {name: 'Changes'})).getByText('1')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Pinned'})).getByText('1')
    ).toBeInTheDocument();
  });

  it('lists pinned items newest first with their type and severity', () => {
    render(
      <AnnotationsPanel
        items={[
          {...change('Delayed ingestion', true), annotationType: 'sentry_outage'},
          {
            ...change('SDK rollout', true),
            annotationType: 'sdk_update',
            severity: 'high',
            start: 1000,
          },
        ]}
        kinds={['timeseriesAnnotation']}
      />
    );

    const [, newest, oldest] = within(
      screen.getByRole('table', {name: 'Pinned annotations'})
    ).getAllByRole('row');
    expect(within(newest!).getByText('SDK update')).toBeInTheDocument();
    expect(within(newest!).getByText('SDK rollout')).toBeInTheDocument();
    expect(within(newest!).getByText('High')).toBeInTheDocument();
    expect(within(oldest!).getByText('Sentry outage')).toBeInTheDocument();
    expect(within(oldest!).getByText('Delayed ingestion')).toBeInTheDocument();
  });

  it('says when nothing is pinned', async () => {
    render(<AnnotationsPanel items={[release]} kinds={['release']} />);

    expect(
      screen.getByText('No pinned annotations in this time range')
    ).toBeInTheDocument();
    expect(await screen.findByText('No releases')).toBeInTheDocument();
  });

  it('lists releases that open the releases drawer', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [ReleaseFixture({version: 'frontend@1.2.0'})],
    });

    const {router} = render(<AnnotationsPanel items={[release]} kinds={['release']} />, {
      initialRouterConfig: {
        location: {
          pathname: '/explore/traces/',
          query: {droppedData: 'spans', contextTab: 'annotations'},
        },
      },
    });

    const releases = screen.getByRole('region', {name: 'Releases'});
    await userEvent.click(await within(releases).findByRole('link', {name: /1\.2\.0/}));

    expect(router.location.query).toEqual(
      expect.objectContaining({
        droppedData: 'spans',
        contextTab: 'annotations',
        rd: 'show',
        rdRelease: 'frontend@1.2.0',
        rdSource: 'chart-context-drawer',
      })
    );
  });

  it('lists flag changes', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/flags/logs/',
      body: {
        data: [
          {
            id: 1,
            action: 'updated',
            createdAt: '2026-11-03T13:00:00Z',
            createdBy: 'user@example.com',
            createdByType: 'email',
            flag: 'new-checkout',
            tags: {},
          },
        ],
      },
    });

    render(<AnnotationsPanel items={[]} kinds={['flag']} />);

    const flags = screen.getByRole('region', {name: 'Flags'});
    expect(await within(flags).findByText('new-checkout')).toBeInTheDocument();
    expect(within(flags).getByText('Updated')).toBeInTheDocument();
  });
});
