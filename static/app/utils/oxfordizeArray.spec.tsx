import {render, screen} from 'sentry-test/reactTestingLibrary';

import oxfordizeArray, {Oxfordize} from 'sentry/utils/oxfordizeArray';

describe('oxfordizeArray', function () {
  it('correctly formats lists of strings', function () {
    const zero = [];
    const one = ['A'];
    const two = ['A', 'B'];
    const three = ['A', 'B', 'C'];
    const four = ['A', 'B', 'C', 'D'];

    expect(oxfordizeArray(zero)).toBe('');
    expect(oxfordizeArray(one)).toBe('A');
    expect(oxfordizeArray(two)).toBe('A and B');
    expect(oxfordizeArray(three)).toBe('A, B, and C');
    expect(oxfordizeArray(four)).toBe('A, B, C, and D');
  });
});

describe('Oxfordize', function () {
  it('correctly formats lists of elements', function () {
    const items = [<i key="1">one</i>, <i key="2">two</i>, <i key="3">three</i>];
    render(<Oxfordize>{items}</Oxfordize>);

    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
    expect(screen.getByText(/, and/)).toBeInTheDocument();
  });

  it('correctly formats one element', function () {
    const items = ['one'];
    render(<Oxfordize>{items}</Oxfordize>);

    expect(screen.getByText('one')).toBeInTheDocument();
  });

  it('correctly formats two elements', function () {
    const items = ['one', <i key="2">two</i>];
    render(<Oxfordize>{items}</Oxfordize>);

    expect(screen.getByText(/one and/)).toBeInTheDocument();
    expect(screen.getByText(/two/)).toBeInTheDocument();
  });
});
