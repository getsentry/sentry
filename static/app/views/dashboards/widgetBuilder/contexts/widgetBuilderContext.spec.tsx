import {Fragment} from 'react';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {
  useWidgetBuilderDispatch,
  useWidgetBuilderStateSlice,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

describe('WidgetBuilderProvider selectors', () => {
  let titleRenders: number;
  let queryRenders: number;
  let capturedDispatch: ReturnType<typeof useWidgetBuilderDispatch>;

  function TitleConsumer() {
    titleRenders++;
    const {title} = useWidgetBuilderStateSlice('title');
    return <div>title:{title}</div>;
  }

  function QueryConsumer() {
    queryRenders++;
    const {query} = useWidgetBuilderStateSlice('query');
    return <div>query:{query?.join(',')}</div>;
  }

  function DispatchGrabber() {
    capturedDispatch = useWidgetBuilderDispatch();
    return null;
  }

  beforeEach(() => {
    titleRenders = 0;
    queryRenders = 0;
  });

  it('only re-renders consumers subscribed to the changed field', () => {
    render(
      <WidgetBuilderProvider>
        <Fragment>
          <TitleConsumer />
          <QueryConsumer />
          <DispatchGrabber />
        </Fragment>
      </WidgetBuilderProvider>
    );

    const titleRendersBefore = titleRenders;
    const queryRendersBefore = queryRenders;

    act(() => {
      capturedDispatch({
        type: BuilderStateAction.SET_TITLE,
        payload: 'a new title',
      });
    });

    expect(screen.getByText('title:a new title')).toBeInTheDocument();
    expect(titleRenders).toBeGreaterThan(titleRendersBefore);
    // The query consumer must not re-render for a title change
    expect(queryRenders).toBe(queryRendersBefore);
  });

  it('persists state to the URL without notifying the router', () => {
    jest.useFakeTimers();
    window.history.replaceState(null, '', '/mock-pathname/');

    const {router} = render(
      <WidgetBuilderProvider>
        <DispatchGrabber />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {pathname: '/mock-pathname/'},
        },
      }
    );

    act(() => {
      capturedDispatch({
        type: BuilderStateAction.SET_TITLE,
        payload: 'url title',
      });
      jest.runAllTimers();
    });

    // The browser URL has the new state for refreshes and copied links
    expect(window.location.search).toContain('title=url%20title');
    // ...but the router (and all of its location subscribers) was not updated
    expect(router.location.query).toEqual({});

    jest.useRealTimers();
    window.history.replaceState(null, '', '/');
  });
});
