import {parseViewHierarchy} from './viewHierarchyParser';

describe('parser', () => {
  it('one layer nesting', () => {
    const testString = `<A: A;>
   | <B: first;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: A',
      children: [
        {
          title: 'B: first',
          children: [],
        },
      ],
    });
  });

  it('multiple layer nesting', () => {
    const testString = `<A: A;>
   | <B: first;>
   |    | <C: first;>
   |    |    | <D: first;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: A',
      children: [
        {
          title: 'B: first',
          children: [
            {
              title: 'C: first',
              children: [
                {
                  title: 'D: first',
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('properly does siblings', () => {
    const testString = `<A: A;>
   | <B: first;>
   | <B: second;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: A',
      children: [
        {
          title: 'B: first',
          children: [],
        },
        {
          title: 'B: second',
          children: [],
        },
      ],
    });
  });

  it('does the other sibling nested thing', () => {
    const testString = `<A: first;>
   | <B: first;>
   |    | <C: first;>
   | <B: second;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: first',
      children: [
        {
          title: 'B: first',
          children: [
            {
              title: 'C: first',
              children: [],
            },
          ],
        },
        {
          title: 'B: second',
          children: [],
        },
      ],
    });
  });

  it('blah', () => {
    const testString = `<A: first;>
   | <B: first;>
   |    | <C: first;>
   |    | <C: second;>
   | <B: second;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: first',
      children: [
        {
          title: 'B: first',
          children: [
            {
              title: 'C: first',
              children: [],
            },
            {
              title: 'C: second',
              children: [],
            },
          ],
        },
        {
          title: 'B: second',
          children: [],
        },
      ],
    });
  });

  it('blah 2', () => {
    const testString = `<A: first;>
   | <B: first;>
   |    | <C: first;>
   |    |    | <D: first;>
   |    | <C: second;>
   |    |    | <D: second;>
   | <B: second;>
   |    | <C: third;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: first',
      children: [
        {
          title: 'B: first',
          children: [
            {
              title: 'C: first',
              children: [
                {
                  title: 'D: first',
                  children: [],
                },
              ],
            },
            {
              title: 'C: second',
              children: [
                {
                  title: 'D: second',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          title: 'B: second',
          children: [
            {
              title: 'C: third',
              children: [],
            },
          ],
        },
      ],
    });
  });
  it.only('blah 3', () => {
    const testString = `<A: first;>
   | <B: first;>
   |    | <C: first;>
   |    |    | <D: first;>
   |    | <C: second;>
   |    |    | <D: second;>
   |    | <C: third;>
   |    |    | <D: third;>
   | <B: second;>`;
    const output = parseViewHierarchy(testString);
    expect(output).toEqual({
      title: 'A: first',
      children: [
        {
          title: 'B: first',
          children: [
            {
              title: 'C: first',
              children: [
                {
                  title: 'D: first',
                  children: [],
                },
              ],
            },
            {
              title: 'C: second',
              children: [
                {
                  title: 'D: second',
                  children: [],
                },
              ],
            },
            {
              title: 'C: third',
              children: [
                {
                  title: 'D: third',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          title: 'B: second',
          children: [],
        },
      ],
    });
  });
  it.skip('does the thing', () => {
    const testString = `<UIWindow: 0x7f893fc0ebd0; frame = (0 0; 375 667); gestureRecognizers = <NSArray: 0x600003478330>; layer = <UIWindowLayer: 0x600003a5a420>>
   | <UILayoutContainerView: 0x7f893fe280a0; frame = (0 0; 375 667); autoresize = W+H; gestureRecognizers = <NSArray: 0x600003440060>; layer = <CALayer: 0x600003a47760>>
   | <UIViewControllerWrapperView: 0x7f893fe32830; frame = (0 0; 375 667); autoresize = W+H; layer = <CALayer: 0x600003a4ffa0>>
   |    | <UIView: 0x7f893fe59060; frame = (-112 0; 375 667); userInteractionEnabled = NO; animations = { position=<CASpringAnimation: 0x600003a94b60>; }; layer = <CALayer: 0x600003a69500>>
   |    | <AnotherUIView: 0x7f893fe59060; frame = (-112 0; 375 667); userInteractionEnabled = NO; animations = { position=<CASpringAnimation: 0x600003a94b60>; }; layer = <CALayer: 0x600003a69500>>
   | <UIView: 0x7f893fe52222; frame = (-112 0; 375 667); userInteractionEnabled = NO; animations = { position=<CASpringAnimation: 0x600003a94b60>; }; layer = <CALayer: 0x600003a69500>>`;
    const output = parseViewHierarchy(testString);
  });
});
