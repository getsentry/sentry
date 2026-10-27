import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ExceptionValue} from 'sentry/types/event';

import {
  RelatedExceptionsTree,
  ToggleRelatedExceptionsButton,
  useHiddenExceptions,
} from './exceptionGroup';

/**
 * Tree structure:
 *   ExceptionGroup (id=0, root)
 *   ├── ValueError (id=1)
 *   └── ExceptionGroup (id=2, nested)
 *       ├── TypeError (id=3)
 *       └── KeyError (id=4)
 */
function makeValues(): ExceptionValue[] {
  const stub = {
    stacktrace: null,
    module: null,
    threadId: null,
    rawStacktrace: null,
  };
  return [
    {
      ...stub,
      type: 'ExceptionGroup',
      value: 'root',
      mechanism: {
        handled: true,
        type: '',
        exception_id: 0,
        is_exception_group: true,
      },
    },
    {
      ...stub,
      type: 'ValueError',
      value: 'bad value',
      mechanism: {handled: true, type: '', exception_id: 1, parent_id: 0},
    },
    {
      ...stub,
      type: 'ExceptionGroup',
      value: 'nested',
      mechanism: {
        handled: true,
        type: '',
        exception_id: 2,
        parent_id: 0,
        is_exception_group: true,
      },
    },
    {
      ...stub,
      type: 'TypeError',
      value: 'type err',
      mechanism: {handled: true, type: '', exception_id: 3, parent_id: 2},
    },
    {
      ...stub,
      type: 'KeyError',
      value: 'key err',
      mechanism: {handled: true, type: '', exception_id: 4, parent_id: 2},
    },
  ];
}

function TestHarness({values}: {values: ExceptionValue[]}) {
  const {hiddenExceptions, toggleRelatedExceptions, expandException} =
    useHiddenExceptions(values);

  return (
    <div>
      {values.map(exc => {
        const id = exc.mechanism?.exception_id;
        const parentId = exc.mechanism?.parent_id;

        if (parentId !== undefined && hiddenExceptions[parentId]) {
          return null;
        }

        return (
          <div key={id} data-test-id={`exc-${id}`}>
            <span>{exc.type}</span>
            <ToggleRelatedExceptionsButton
              exception={exc}
              hiddenExceptions={hiddenExceptions}
              toggleRelatedExceptions={toggleRelatedExceptions}
              values={values}
            />
            <RelatedExceptionsTree
              exception={exc}
              allExceptions={values}
              newestFirst={false}
              onExceptionClick={expandException}
            />
          </div>
        );
      })}
    </div>
  );
}

describe('exceptionGroup', () => {
  it('hides nested group children by default, reveals on toggle, and expands via tree link', async () => {
    render(<TestHarness values={makeValues()} />);

    // Root group and its direct children are visible
    expect(screen.getByTestId('exc-0')).toBeInTheDocument();
    expect(screen.getByTestId('exc-1')).toBeInTheDocument();
    expect(screen.getByTestId('exc-2')).toBeInTheDocument();

    // Nested group's children are hidden
    expect(screen.queryByTestId('exc-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exc-4')).not.toBeInTheDocument();

    // Toggle reveals nested group's children
    await userEvent.click(
      screen.getByRole('button', {name: 'Show 2 related exceptions'})
    );
    expect(screen.getByTestId('exc-3')).toBeInTheDocument();
    expect(screen.getByTestId('exc-4')).toBeInTheDocument();

    // Toggle hides them again
    await userEvent.click(
      screen.getByRole('button', {name: 'Hide 2 related exceptions'})
    );
    expect(screen.queryByTestId('exc-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exc-4')).not.toBeInTheDocument();

    // Clicking a child link in the nested group's tree calls expandException,
    // which un-hides the parent group's children
    await userEvent.click(screen.getByRole('button', {name: 'TypeError: type err'}));
    expect(screen.getByTestId('exc-3')).toBeInTheDocument();
    expect(screen.getByTestId('exc-4')).toBeInTheDocument();
  });

  it('renders colored text without escape codes when given ANSI exception values', () => {
    const values = makeValues().map(exception => {
      if (exception.type === 'ValueError') {
        return {...exception, value: '\x1B[31mbad\x1B[0m value'};
      }
      if (exception.mechanism?.exception_id === 0) {
        return {...exception, value: '\x1B[32mroot\x1B[0m group'};
      }
      return exception;
    });

    render(
      <RelatedExceptionsTree
        exception={values[0]!}
        allExceptions={values}
        newestFirst={false}
        onExceptionClick={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', {name: 'ValueError: bad value'})
    ).toBeInTheDocument();
    expect(screen.getByText('bad').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('root').closest('div')).toHaveTextContent(
      /^ExceptionGroup: root group$/
    );
    expect(screen.getByText('root').style.color).toContain('color-mix(in srgb,');
  });
});
