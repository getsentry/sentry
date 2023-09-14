import {render, screen} from 'sentry-test/reactTestingLibrary';

import oxfordizeArray, {oxfordizeElements} from 'sentry/utils/oxfordizeArray';

describe('oxfordizeArray', function () {
  it('correctly formats lists of strings', function () {
    const zero = [];
    const one = ['A'];
    const two = ['A', 'B'];
    const three = ['A', 'B', 'C'];
    const four = ['A', 'B', 'C', 'D'];

    expect(oxfordizeArray(zero)).toEqual('');
    expect(oxfordizeArray(one)).toEqual('A');
    expect(oxfordizeArray(two)).toEqual('A and B');
    expect(oxfordizeArray(three)).toEqual('A, B, and C');
    expect(oxfordizeArray(four)).toEqual('A, B, C, and D');
  });
});

describe('oxfordizeElements', function () {
  it('correctly formats lists of elements', function () {
    const items = [<i key="1">one</i>, <i key="2">two</i>, <i key="3">three</i>];
    render(oxfordizeElements(items));

    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.getByText('three')).toBeInTheDocument();
    expect(screen.getByText(/, and/)).toBeInTheDocument();
  });
});
