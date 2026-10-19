import {createRef, Fragment} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Menu} from '@sentry/scraps/menu';

describe('Menu.ListItems', () => {
  it('attaches the ref to the default li wrapper', () => {
    const ref = createRef<HTMLLIElement>();

    render(<Menu.ListItems label="Action" ref={ref} />);

    expect(ref.current?.tagName).toBe('LI');
    expect(ref.current).toContainElement(screen.getByText('Action'));
  });

  it('attaches the ref to the specified wrapper', () => {
    const ref = createRef<HTMLDivElement>();

    render(<Menu.ListItems as="div" label="Action" ref={ref} />);

    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current).toContainElement(screen.getByText('Action'));
  });

  it('infers the ref type from the wrapper element', () => {
    render(
      <Fragment>
        <Menu.ListItems
          label="Default"
          ref={element => {
            expectTypeOf(element).toEqualTypeOf<HTMLLIElement | null>();
          }}
        />
        <Menu.ListItems
          as="div"
          label="Action"
          ref={element => {
            expectTypeOf(element).toEqualTypeOf<HTMLDivElement | null>();
          }}
        />
      </Fragment>
    );

    expectTypeOf<Parameters<typeof Menu.ListItems<'li'>>[0]['ref']>().toEqualTypeOf<
      React.Ref<HTMLLIElement> | undefined
    >();
    expectTypeOf<Parameters<typeof Menu.ListItems<'div'>>[0]['ref']>().toEqualTypeOf<
      React.Ref<HTMLDivElement> | undefined
    >();
  });
});
