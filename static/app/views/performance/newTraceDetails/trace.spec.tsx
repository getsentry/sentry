import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TraceView} from 'sentry/views/performance/newTraceDetails/index';

describe('trace view', () => {
  it('renders loading state', () => {
    render(<TraceView />);

    expect(screen.findByTestId('trace-view-loading')).toBeInTheDocument();
  });
  it.todo('renders error state', () => {});
  it.todo('renders empty state', () => {});

  describe('keyboard navigation', () => {
    it.todo('keyup');
    it.todo('keydown');
    it.todo('arrow right expands');
    it.todo('arrow right zooms in');
    it.todo('arrow left zooms out');
    it.todo('arrow left collapses');
  });

  describe('search', () => {
    it.todo('marks results as matched', () => {});

    describe('keyboard navigation', () => {
      it.todo('arrow down');
      it.todo('arrow up');
      it.todo('enter');
      it.todo('shift');
    });
  });
});
