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

function change(id: string, severity: AnnotationItem['severity']): AnnotationItem {
  return {id, kind: 'timeseriesAnnotation', start: 0, title: id, severity};
}

describe('AnnotationsPanel', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({url: '/organizations/org-slug/releases/', body: []});
  });

  it('lists severe items under Severe and the rest under their kind', () => {
    render(
      <AnnotationsPanel
        items={[change('outage', 'high'), change('sdk-update', 'low')]}
        kinds={['timeseriesAnnotation']}
      />
    );

    expect(
      within(screen.getByRole('region', {name: 'Changes'})).getByText('1')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Severe'})).getByText('1')
    ).toBeInTheDocument();
  });

  it('says when nothing is severe', async () => {
    render(<AnnotationsPanel items={[release]} kinds={['release']} />);

    expect(
      screen.getByText('No severe annotations in this time range')
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
});
