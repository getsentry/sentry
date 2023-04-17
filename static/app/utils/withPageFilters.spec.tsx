import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {PageFilters} from 'sentry/types';
import withPageFilters from 'sentry/utils/withPageFilters';

describe('withPageFilters HoC', function () {
  beforeEach(() => {
    PageFiltersStore.reset();
    PageFiltersStore.init();
  });

  it('handles projects', function () {
    function PrintProjectsComponent({selection}: {selection: PageFilters}) {
      return (
        <div>
          {selection.projects.map(project => (
            <div data-test-id="project" key={project}>
              {project}
            </div>
          ))}
        </div>
      );
    }

    const Container = withPageFilters(PrintProjectsComponent);

    render(<Container />);

    expect(screen.queryByTestId('project')).not.toBeInTheDocument();

    act(() => PageFiltersStore.updateProjects([1, 2], []));

    expect(screen.getAllByTestId('project')).toHaveLength(2);
    expect(screen.getAllByTestId('project')[0]).toHaveTextContent('1');
    expect(screen.getAllByTestId('project')[1]).toHaveTextContent('2');
  });

  it('handles datetime', function () {
    function PrintDatetimeComponent({selection}) {
      return (
        <div>
          <div data-test-id="period">{selection.datetime.period}</div>
          <div data-test-id="start">{selection.datetime.start}</div>
          <div data-test-id="end">{selection.datetime.end}</div>
        </div>
      );
    }

    const Container = withPageFilters(PrintDatetimeComponent);

    render(<Container />);

    expect(screen.getByTestId('period')).toHaveTextContent('14d');
    expect(screen.getByTestId('start')).toBeEmptyDOMElement();
    expect(screen.getByTestId('end')).toBeEmptyDOMElement();

    act(() =>
      PageFiltersStore.updateDateTime({
        period: '7d',
        start: null,
        end: null,
        utc: true,
      })
    );

    expect(screen.getByTestId('period')).toHaveTextContent('7d');
    expect(screen.getByTestId('start')).toBeEmptyDOMElement();
    expect(screen.getByTestId('end')).toBeEmptyDOMElement();

    act(() =>
      PageFiltersStore.updateDateTime({
        period: null,
        start: '2018-08-08T00:00:00',
        end: '2018-08-09T00:00:00',
        utc: true,
      })
    );
    expect(screen.getByTestId('period')).toBeEmptyDOMElement();
    expect(screen.getByTestId('start')).toHaveTextContent('2018-08-08T00:00:00');
    expect(screen.getByTestId('end')).toHaveTextContent('2018-08-09T00:00:00');
  });

  it('handles environments', function () {
    function PrintProjectsComponent({selection}) {
      return (
        <div>
          {selection.environments.map(env => (
            <div data-test-id="environment" key={env}>
              {env}
            </div>
          ))}
        </div>
      );
    }

    const Container = withPageFilters(PrintProjectsComponent);

    render(<Container />);

    expect(screen.queryByTestId('environment')).not.toBeInTheDocument();

    act(() => PageFiltersStore.updateEnvironments(['beta', 'alpha']));

    expect(screen.getAllByTestId('environment')).toHaveLength(2);
    expect(screen.getAllByTestId('environment')[0]).toHaveTextContent('beta');
    expect(screen.getAllByTestId('environment')[1]).toHaveTextContent('alpha');
  });
});
