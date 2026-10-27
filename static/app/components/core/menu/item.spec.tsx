import {createRef, Fragment} from 'react';
import {useFloating} from '@floating-ui/react-dom';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ListItem, ReserveLeadingSlot} from '@sentry/scraps/menu';

jest.mock('@floating-ui/react-dom', () => ({
  ...jest.requireActual('@floating-ui/react-dom'),
  useFloating: jest.fn(),
}));

const setReference = jest.fn();

describe('ListItem', () => {
  beforeEach(() => {
    setReference.mockReset();
    jest
      .mocked(useFloating)
      .mockImplementation(({placement = 'bottom', strategy = 'absolute'} = {}) => ({
        x: 0,
        y: 0,
        placement,
        strategy,
        middlewareData: {},
        isPositioned: false,
        update: jest.fn(),
        refs: {
          reference: {current: null},
          floating: {current: null},
          setReference,
          setFloating: jest.fn(),
        },
        elements: {reference: null, floating: null},
        floatingStyles: {position: strategy, left: 0, top: 0},
      }));
  });

  it('attaches the ref to the default li wrapper', () => {
    const ref = createRef<HTMLLIElement>();

    render(<ListItem label="Action" ref={ref} />);

    expect(ref.current?.tagName).toBe('LI');
    expect(ref.current).toContainElement(screen.getByText('Action'));
  });

  it('attaches the ref to the specified wrapper', () => {
    const ref = createRef<HTMLDivElement>();

    render(<ListItem as="div" label="Action" ref={ref} />);

    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current).toContainElement(screen.getByText('Action'));
  });

  it('infers the ref type from the wrapper element', () => {
    render(
      <Fragment>
        <ListItem
          label="Default"
          ref={element => {
            expectTypeOf(element).toEqualTypeOf<HTMLLIElement | null>();
          }}
        />
        <ListItem
          as="div"
          label="Action"
          ref={element => {
            expectTypeOf(element).toEqualTypeOf<HTMLDivElement | null>();
          }}
        />
      </Fragment>
    );

    expectTypeOf<Parameters<typeof ListItem<'li'>>[0]['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<Parameters<typeof ListItem<'div'>>[0]['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
  });

  it('reserves an empty leading slot so labels line up with items that have icons', () => {
    function getContentChildCount(label: string) {
      return screen
        .getByText(label)
        .closest('[data-menu-item-content]')
        ?.querySelectorAll(':scope > *').length;
    }

    const {rerender} = render(
      <Fragment>
        <ListItem label="With icon" leadingItems={<span>icon</span>} />
        <ListItem label="Plain" />
      </Fragment>
    );

    expect(getContentChildCount('Plain')).toBeLessThan(
      getContentChildCount('With icon')!
    );

    rerender(
      <ReserveLeadingSlot reserve>
        <ListItem label="With icon" leadingItems={<span>icon</span>} />
        <ListItem label="Plain" />
      </ReserveLeadingSlot>
    );

    expect(getContentChildCount('Plain')).toBe(getContentChildCount('With icon'));
  });

  it('positions the details overlay against an item that mounts focused', () => {
    const ref = createRef<HTMLLIElement>();

    render(
      <ListItem label="Action" details="More" showDetailsInOverlay isFocused ref={ref} />
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('More');
    expect(setReference).toHaveBeenLastCalledWith(ref.current);
  });

  it('positions the details overlay against an item focused after mounting', () => {
    const ref = createRef<HTMLLIElement>();

    const {rerender} = render(
      <ListItem label="Action" details="More" showDetailsInOverlay ref={ref} />
    );
    rerender(
      <ListItem label="Action" details="More" showDetailsInOverlay isFocused ref={ref} />
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('More');
    expect(setReference).toHaveBeenLastCalledWith(ref.current);
  });
});
