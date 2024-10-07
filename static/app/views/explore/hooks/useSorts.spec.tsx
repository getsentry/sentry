import {act, render} from 'sentry-test/reactTestingLibrary';

import {useSorts} from 'sentry/views/explore/hooks/useSorts';

describe('useSorts', function () {
  it('allows changing sorts', function () {
    let sorts, setSorts;

    const fields = ['id', 'timestamp'];

    function TestPage() {
      [sorts, setSorts] = useSorts({fields});
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    expect(sorts).toEqual([
      {
        kind: 'desc',
        field: 'timestamp',
      },
    ]); // default

    act(() =>
      setSorts([
        {
          kind: 'asc',
          field: 'timestamp',
        },
      ])
    );
    expect(sorts).toEqual([
      {
        kind: 'asc',
        field: 'timestamp',
      },
    ]);

    act(() =>
      setSorts([
        {
          kind: 'desc',
          field: 'id',
        },
      ])
    );
    expect(sorts).toEqual([
      {
        kind: 'desc',
        field: 'id',
      },
    ]);
  });

  it('falls back to timestamp desc if possible', function () {
    let sorts, setSorts;

    const fields = ['id', 'timestamp'];

    function TestPage() {
      [sorts, setSorts] = useSorts({fields});
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    act(() =>
      setSorts([
        {
          kind: 'asc',
          field: 'foo',
        },
      ])
    );
    expect(sorts).toEqual([
      {
        kind: 'desc',
        field: 'timestamp',
      },
    ]);
  });

  it('falls back to first column desc if timestamp is not available', function () {
    let sorts, setSorts;

    const fields = ['id'];

    function TestPage() {
      [sorts, setSorts] = useSorts({fields});
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    act(() =>
      setSorts([
        {
          kind: 'asc',
          field: 'foo',
        },
      ])
    );
    expect(sorts).toEqual([
      {
        kind: 'desc',
        field: 'id',
      },
    ]);
  });
});
