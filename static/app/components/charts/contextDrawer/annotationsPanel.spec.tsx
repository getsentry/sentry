import {render, screen, within} from 'sentry-test/reactTestingLibrary';

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

  it('says when nothing is severe', () => {
    render(<AnnotationsPanel items={[release]} kinds={['release']} />);

    expect(
      screen.getByText('No severe annotations in this time range')
    ).toBeInTheDocument();
  });
});
