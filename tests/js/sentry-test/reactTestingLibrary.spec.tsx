import {useRef} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

describe('rerender', () => {
  // Taken from https://testing-library.com/docs/example-update-props/
  let idCounter = 1;

  function NumberDisplay({number}) {
    const id = useRef(idCounter++); // to ensure we don't remount a different instance

    return (
      <div>
        <span data-test-id="number-display">{number}</span>
        <span data-test-id="instance-id">{id.current}</span>
      </div>
    );
  }

  test('calling render with the same component on the same container does not remount', () => {
    const {rerender} = render(<NumberDisplay number={1} />);
    expect(screen.getByTestId('number-display')).toHaveTextContent('1');

    // re-render the same component with different props
    rerender(<NumberDisplay number={2} />);
    expect(screen.getByTestId('number-display')).toHaveTextContent('2');

    expect(screen.getByTestId('instance-id')).toHaveTextContent('1');
  });
});
