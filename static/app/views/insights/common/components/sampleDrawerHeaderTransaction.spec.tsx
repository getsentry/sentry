import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SampleDrawerHeaderTransaction} from './sampleDrawerHeaderTransaction';

describe('SampleDrawerHeaderTransaction', () => {
  it('Links to the transaction summary page', () => {
    const project = ProjectFixture();

    render(<SampleDrawerHeaderTransaction project={project} transaction="/issues" />);

    const $link = screen.getByRole('link');
    expect($link).toHaveAccessibleName('/issues');
    expect($link).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/summary?project=project-slug&transaction=%2Fissues'
    );
  });

  it('Shows transaction method', () => {
    const project = ProjectFixture();

    render(
      <SampleDrawerHeaderTransaction
        project={project}
        transaction="/issues"
        transactionMethod="GET"
      />
    );

    const $link = screen.getByRole('link');
    expect($link).toHaveAccessibleName('GET /issues');
  });

  it('Strips duplicate transaction method', () => {
    const project = ProjectFixture();

    render(
      <SampleDrawerHeaderTransaction
        project={project}
        transaction="GET /issues"
        transactionMethod="GET"
      />
    );

    const $link = screen.getByRole('link');
    expect($link).toHaveAccessibleName('GET /issues');
  });
});
