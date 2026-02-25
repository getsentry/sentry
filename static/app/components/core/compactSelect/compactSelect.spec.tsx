import {Fragment, useState} from 'react';
import {expectTypeOf} from 'expect-type';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import DropdownButton from 'sentry/components/dropdownButton';

import {CompactSelect, type SelectOption} from './';

describe('CompactSelect', () => {
  describe('types', () => {
    it('should enforce correct types for onChange for SingleSelect', () => {
      void (
        <CompactSelect
          value="opt_one"
          onChange={option => {
            expectTypeOf(option).toEqualTypeOf<SelectOption<'opt_one' | 'opt_two'>>();
          }}
          closeOnSelect={option => {
            expectTypeOf(option).toEqualTypeOf<SelectOption<'opt_one' | 'opt_two'>>();
            return true;
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
    });

    it('should add undefined to onChange when clearable for SingleSelect', () => {
      void (
        <CompactSelect
          value="opt_one"
          clearable
          onChange={option => {
            expectTypeOf(option).toEqualTypeOf<
              SelectOption<'opt_one' | 'opt_two'> | undefined
            >();
          }}
          closeOnSelect={option => {
            expectTypeOf(option).toEqualTypeOf<
              SelectOption<'opt_one' | 'opt_two'> | undefined
            >();
            return true;
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
    });

    it('should always use arrays for MultiSelect', () => {
      const values: Array<'opt_one' | 'opt_two'> = ['opt_one'];
      void (
        <CompactSelect
          value={values}
          multiple
          onChange={option => {
            expectTypeOf(option).toEqualTypeOf<
              Array<SelectOption<'opt_one' | 'opt_two'>>
            >();
          }}
          closeOnSelect={option => {
            expectTypeOf(option).toEqualTypeOf<
              Array<SelectOption<'opt_one' | 'opt_two'>>
            >();
            return true;
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      void (
        <CompactSelect
          value={values}
          multiple
          clearable
          onChange={option => {
            expectTypeOf(option).toEqualTypeOf<
              Array<SelectOption<'opt_one' | 'opt_two'>>
            >();
          }}
          closeOnSelect={option => {
            expectTypeOf(option).toEqualTypeOf<
              Array<SelectOption<'opt_one' | 'opt_two'>>
            >();
            return true;
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
    });

    it('should only allow SelectTrigger as trigger', () => {
      const value: 'opt_one' | 'opt_two' = 'opt_one';
      void (
        <CompactSelect
          value={value}
          onChange={() => {}}
          trigger={props => {
            // @ts-expect-error should only allow SelectTrigger components
            return <DropdownButton {...props}>Trigger</DropdownButton>;
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      void (
        <CompactSelect
          value={value}
          onChange={() => {}}
          trigger={props => {
            // no type error here
            return <OverlayTrigger.Button {...props}>Trigger</OverlayTrigger.Button>;
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
    });

    it('should not allow undefined or null as children of SelectTrigger', () => {
      void (
        <CompactSelect
          value=""
          onChange={() => {}}
          trigger={props => {
            // @ts-expect-error TS2322: Type null is not assignable to type NonNullable<ReactNode>
            return <OverlayTrigger.Button {...props}>{null}</OverlayTrigger.Button>;
          }}
          options={[]}
        />
      );
      void (
        <CompactSelect
          value=""
          onChange={() => {}}
          trigger={props => {
            return (
              // @ts-expect-error TS2322: Type undefined is not assignable to type NonNullable<ReactNode>
              <OverlayTrigger.Button {...props}>{undefined}</OverlayTrigger.Button>
            );
          }}
          options={[]}
        />
      );
    });
  });

  it('renders', async () => {
    render(
      <CompactSelect
        value={undefined}
        onChange={jest.fn()}
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(await screen.findByRole('button', {name: 'None'})).toBeEnabled();
  });

  it('renders disabled', async () => {
    render(
      <CompactSelect
        disabled
        value={undefined}
        onChange={jest.fn()}
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(await screen.findByRole('button', {name: 'None'})).toBeDisabled();
  });

  it('renders with menu title', async () => {
    render(
      <CompactSelect
        menuTitle="Menu title"
        value={undefined}
        onChange={jest.fn()}
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Menu title')).toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    render(
      <Fragment>
        <CompactSelect
          value="opt_one"
          menuTitle="Menu A"
          onChange={jest.fn()}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
        <CompactSelect
          value="opt_three"
          menuTitle="Menu B"
          onChange={jest.fn()}
          options={[
            {value: 'opt_three', label: 'Option Three'},
            {value: 'opt_four', label: 'Option Four'},
          ]}
        />
      </Fragment>
    );

    // Can be dismissed by clicking outside
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    await userEvent.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Option One'})).toHaveFocus();
    });

    // Can be dismissed by pressing Escape
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus();
    });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Option One'})).toHaveFocus();
    });

    // When menu A is open, clicking once on menu B's trigger button closes menu A and
    // then opens menu B
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Option Three'}));
    expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'Option Three'})).toBeInTheDocument();
  });

  it('closes menu when clear is clicked', async () => {
    render(
      <CompactSelect
        clearable
        value="opt_one"
        onChange={jest.fn()}
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // open the menu
    await userEvent.click(screen.getByRole('button', {name: 'Option One'}));
    expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();

    // click the clear button
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    // menu is closed
    await waitFor(() => {
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });
  });

  describe('ListBox', () => {
    it('updates trigger label on selection', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string>();
        return (
          <CompactSelect
            value={state}
            options={[
              {value: 'opt_one', label: 'Option One'},
              {value: 'opt_two', label: 'Option Two'},
            ]}
            onChange={selection => {
              mock(selection);
              setState(selection.value);
            }}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One
      await userEvent.click(screen.getByRole('option', {name: 'Option One'}));

      expect(mock).toHaveBeenCalledWith({value: 'opt_one', label: 'Option One'});
      expect(screen.getByRole('button', {name: 'Option One'})).toBeInTheDocument();
    });

    it('can select multiple options', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string[]>([]);
        return (
          <CompactSelect
            multiple
            options={[
              {value: 'opt_one', label: 'Option One'},
              {value: 'opt_two', label: 'Option Two'},
            ]}
            onChange={selection => {
              mock(selection);
              setState(selection.map(opt => opt.value));
            }}
            value={state}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('option', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('option', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: 'opt_one', label: 'Option One'},
        {value: 'opt_two', label: 'Option Two'},
      ]);
      expect(screen.getByRole('button', {name: 'Option One +1'})).toBeInTheDocument();
    });

    it('can select options with values containing quotes', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string[]>([]);
        return (
          <CompactSelect
            multiple
            options={[
              {value: '"opt_one"', label: 'Option One'},
              {value: '"opt_two"', label: 'Option Two'},
            ]}
            onChange={selection => {
              mock(selection);
              setState(selection.map(opt => opt.value));
            }}
            value={state}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('option', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('option', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: '"opt_one"', label: 'Option One'},
        {value: '"opt_two"', label: 'Option Two'},
      ]);
    });

    it('displays trigger button with prefix', async () => {
      render(
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Prefix" />
          )}
          value="opt_one"
          onChange={jest.fn()}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );
      expect(
        await screen.findByRole('button', {name: 'Prefix Option One'})
      ).toBeInTheDocument();
    });

    it('can search', async () => {
      render(
        <CompactSelect
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // type 'Two' into the search box
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');

      // only Option Two should be available, Option One should be filtered out
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
    });

    it('restores full list when search query is cleared', async () => {
      render(
        <CompactSelect
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));

      // type 'Two' to filter to one option
      await userEvent.keyboard('Two');
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

      // clear the search query — all options should return
      await userEvent.clear(screen.getByPlaceholderText('Search here…'));
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
    });

    it('resets search query and shows all options when menu is closed and reopened', async () => {
      render(
        <CompactSelect
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      // open the menu and filter results
      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();

      // close the menu by clicking outside
      await userEvent.click(document.body);
      await waitFor(() => {
        expect(
          screen.queryByRole('option', {name: 'Option Two'})
        ).not.toBeInTheDocument();
      });

      // reopen the menu — search input should be empty and all options visible
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search here…')).toHaveValue('');
      });
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
    });

    it('uses custom searchMatcher when provided', async () => {
      render(
        <CompactSelect
          search={{
            placeholder: 'Search here…',
            filter: (option, search) => ({
              score: String(option.value).endsWith(search) ? 1 : 0,
            }),
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));

      // '_one' matches opt_one by value suffix, opt_two does not match
      await userEvent.keyboard('_one');
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option Two'})).not.toBeInTheDocument();
    });

    it('does not call searchMatcher when search is empty, showing all options', async () => {
      // A matcher that returns score 0 for any empty query would hide all options if
      // called during the initial render (before the user types anything).
      render(
        <CompactSelect
          search={{
            placeholder: 'Search here…',
            filter: (option, search) => ({
              // Return 0 for empty search — real-world matchers may do this
              score: search === '' ? 0 : String(option.value).includes(search) ? 1 : 0,
            }),
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));

      // All options should be visible even though the matcher returns 0 for ''
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
    });

    it('uses string.includes for default search matching', async () => {
      render(
        <CompactSelect
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));

      // 'ption On' is a mid-string substring of 'Option One' — only includes() catches it
      await userEvent.keyboard('ption On');
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option Two'})).not.toBeInTheDocument();
    });

    it('sorts options by score when searchMatcher returns SearchMatchResult', async () => {
      // Assign scores so the natural order (One, Two, Three) is reversed: Three > Two > One
      const scores: Record<string, number> = {opt_one: 1, opt_two: 2, opt_three: 3};

      render(
        <CompactSelect
          search={{
            placeholder: 'Search here…',
            filter: option => ({score: scores[String(option.value)] ?? 0}),
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('opt');

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('Option Three'); // score 3
      expect(options[1]).toHaveTextContent('Option Two'); // score 2
      expect(options[2]).toHaveTextContent('Option One'); // score 1
    });

    it('options with equal scores maintain their original relative order', async () => {
      // opt_two gets a higher score; opt_one and opt_three share the same low score
      // and should keep their original relative order (One before Three)
      render(
        <CompactSelect
          search={{
            placeholder: 'Search here…',
            filter: option => ({score: option.value === 'opt_two' ? 10 : 1}),
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('opt');

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('Option Two'); // score 10
      expect(options[1]).toHaveTextContent('Option One'); // no score, original order
      expect(options[2]).toHaveTextContent('Option Three'); // no score, original order
    });

    it('sizeLimit keeps highest-scored options visible, not first-in-order options', async () => {
      // Natural order: One (score 1), Two (score 3), Three (score 2).
      // sizeLimit=2 should keep the two highest-scored items: Two (3) and Three (2),
      // not the first two in original order: One (1) and Two (3).
      const scores: Record<string, number> = {opt_one: 1, opt_two: 3, opt_three: 2};

      render(
        <CompactSelect
          search={{
            placeholder: 'Search here…',
            filter: option => ({score: scores[String(option.value)] ?? 0}),
          }}
          sizeLimit={2}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('opt');

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('Option Two'); // score 3, visible
      expect(options[1]).toHaveTextContent('Option Three'); // score 2, visible
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument(); // score 1, hidden
    });

    it('passes option and search string to searchMatcher', async () => {
      const searchMatcher = jest.fn().mockReturnValue({score: 1});

      render(
        <CompactSelect
          search={{placeholder: 'Search here…', filter: searchMatcher}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('test');

      expect(searchMatcher).toHaveBeenCalledWith(
        expect.objectContaining({value: 'opt_one', label: 'Option One'}),
        'test'
      );
    });

    it('can search with sections', async () => {
      render(
        <CompactSelect
          value={undefined}
          onChange={jest.fn()}
          search={{placeholder: 'Search here…'}}
          options={[
            {
              key: 'section-1',
              label: 'Section 1',
              showToggleAllButton: true,
              options: [
                {value: 'opt_one', label: 'Option One'},
                {value: 'opt_two', label: 'Option Two'},
              ],
            },
            {
              key: 'section-2',
              label: 'Section 2',
              showToggleAllButton: true,
              options: [
                {value: 'opt_three', label: 'Option Three'},
                {value: 'opt_four', label: 'Option Four'},
              ],
            },
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // type 'Two' into the search box
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');

      // only Option Two should be available
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option One'})).not.toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('uses custom searchMatcher with sections', async () => {
      render(
        <CompactSelect
          value={undefined}
          onChange={jest.fn()}
          search={{
            placeholder: 'Search here…',
            filter: (option, search) => ({
              score: String(option.value).endsWith(search) ? 1 : 0,
            }),
          }}
          options={[
            {
              key: 'section-1',
              label: 'Section 1',
              options: [
                {value: 'opt_one', label: 'Option One'},
                {value: 'opt_two', label: 'Option Two'},
              ],
            },
            {
              key: 'section-2',
              label: 'Section 2',
              options: [
                {value: 'opt_three', label: 'Option Three'},
                {value: 'opt_four', label: 'Option Four'},
              ],
            },
          ]}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));

      // 'e' matches opt_one (section 1) and opt_three (section 2) by value suffix
      await userEvent.keyboard('e');
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option Two'})).not.toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Option Three'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Option Four'})).not.toBeInTheDocument();
    });

    it('can limit the number of options', async () => {
      render(
        <CompactSelect
          value={undefined}
          onChange={jest.fn()}
          sizeLimit={2}
          sizeLimitMessage="Use search for more options…"
          search
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // only the first two options should be visible due to `sizeLimit`
      expect(screen.getByRole('option', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Option Two'})).toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Option Three'})
      ).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toHaveFocus();
      });
      // Option Three is not reachable via keyboard, focus wraps back to Option One
      await userEvent.keyboard(`{ArrowDown}`);
      await waitFor(() => {
        expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus();
      });
      await userEvent.keyboard(`{ArrowDown>2}`);
      await waitFor(() => {
        expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus();
      });

      // Option Three is still available via search
      await userEvent.type(screen.getByPlaceholderText('Search…'), 'three');
      expect(screen.getByRole('option', {name: 'Option Three'})).toBeInTheDocument();
    });

    it('can toggle sections', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string[]>([]);

        return (
          <CompactSelect
            multiple
            onSectionToggle={mock}
            value={state}
            onChange={selection => {
              mock(selection);
              setState(selection.map(opt => opt.value));
            }}
            options={[
              {
                key: 'section-1',
                label: 'Section 1',
                showToggleAllButton: true,
                options: [
                  {value: 'opt_one', label: 'Option One'},
                  {value: 'opt_two', label: 'Option Two'},
                ],
              },
              {
                key: 'section-2',
                label: 'Section 2',
                showToggleAllButton: true,
                options: [
                  {value: 'opt_three', label: 'Option Three'},
                  {value: 'opt_four', label: 'Option Four'},
                ],
              },
            ]}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button', {expanded: false}));
      await waitFor(() =>
        expect(screen.getByRole('option', {name: 'Option One'})).toHaveFocus()
      );

      // move focus to Section 1's toggle button and press it to select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 1'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('option', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'select'
      );

      // press Section 1's toggle button again to unselect all
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('option', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(screen.getByRole('option', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'unselect'
      );

      // move to Section 2's toggle button and select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 2'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('option', {name: 'Option Three'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('option', {name: 'Option Four'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-2',
          label: 'Section 2',
          showToggleAllButton: true,
          options: [
            {key: 'opt_three', value: 'opt_three', label: 'Option Three'},
            {key: 'opt_four', value: 'opt_four', label: 'Option Four'},
          ],
        },
        'select'
      );
    });

    it('triggers onClose when the menu is closed if provided', async () => {
      const onCloseMock = jest.fn();
      render(
        <CompactSelect
          onClose={onCloseMock}
          value={undefined}
          onChange={jest.fn()}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));
      expect(onCloseMock).not.toHaveBeenCalled();

      // close the menu
      await userEvent.click(document.body);
      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalled();
      });
    });
  });

  describe('GridList', () => {
    it('updates trigger label on selection', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string>();

        return (
          <CompactSelect
            grid
            value={state}
            options={[
              {value: 'opt_one', label: 'Option One'},
              {value: 'opt_two', label: 'Option Two'},
            ]}
            onChange={selection => {
              mock(selection);
              setState(selection.value);
            }}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));

      expect(mock).toHaveBeenCalledWith({value: 'opt_one', label: 'Option One'});
      expect(screen.getByRole('button', {name: 'Option One'})).toBeInTheDocument();
    });

    it('can select multiple options', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string[]>([]);
        return (
          <CompactSelect
            grid
            multiple
            options={[
              {value: 'opt_one', label: 'Option One'},
              {value: 'opt_two', label: 'Option Two'},
            ]}
            onChange={selection => {
              mock(selection);
              setState(selection.map(opt => opt.value));
            }}
            value={state}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: 'opt_one', label: 'Option One'},
        {value: 'opt_two', label: 'Option Two'},
      ]);
      expect(screen.getByRole('button', {name: 'Option One +1'})).toBeInTheDocument();
    });

    it('can select options with values containing quotes', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string[]>([]);
        return (
          <CompactSelect
            grid
            multiple
            options={[
              {value: '"opt_one"', label: 'Option One'},
              {value: '"opt_two"', label: 'Option Two'},
            ]}
            onChange={selection => {
              mock(selection);
              setState(selection.map(opt => opt.value));
            }}
            value={state}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // select Option One & Option Two
      await userEvent.click(screen.getByRole('row', {name: 'Option One'}));
      await userEvent.click(screen.getByRole('row', {name: 'Option Two'}));

      expect(mock).toHaveBeenCalledWith([
        {value: '"opt_one"', label: 'Option One'},
        {value: '"opt_two"', label: 'Option Two'},
      ]);
    });

    it('displays trigger button with prefix', async () => {
      render(
        <CompactSelect
          grid
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Prefix" />
          )}
          value="opt_one"
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          onChange={jest.fn()}
        />
      );
      expect(
        await screen.findByRole('button', {name: 'Prefix Option One'})
      ).toBeInTheDocument();
    });

    it('can search', async () => {
      render(
        <CompactSelect
          grid
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // type 'Two' into the search box
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');

      // only Option Two should be available, Option One should be filtered out
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('row', {name: 'Option One'})).not.toBeInTheDocument();
    });

    it('restores full list when search query is cleared', async () => {
      render(
        <CompactSelect
          grid
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));

      // type 'Two' to filter to one option
      await userEvent.keyboard('Two');
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('row', {name: 'Option One'})).not.toBeInTheDocument();

      // clear the search query — all options should return
      await userEvent.clear(screen.getByPlaceholderText('Search here…'));
      expect(screen.getByRole('row', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
    });

    it('resets search query and shows all options when menu is closed and reopened', async () => {
      render(
        <CompactSelect
          grid
          search={{placeholder: 'Search here…'}}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      // open the menu and filter results
      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));
      await userEvent.keyboard('Two');
      expect(screen.queryByRole('row', {name: 'Option One'})).not.toBeInTheDocument();

      // close the menu by clicking outside
      await userEvent.click(document.body);
      await waitFor(() => {
        expect(screen.queryByRole('row', {name: 'Option Two'})).not.toBeInTheDocument();
      });

      // reopen the menu — search input should be empty and all options visible
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search here…')).toHaveValue('');
      });
      expect(screen.getByRole('row', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
    });

    it('uses custom searchMatcher when provided', async () => {
      render(
        <CompactSelect
          grid
          search={{
            placeholder: 'Search here…',
            filter: (option, search) => ({
              score: String(option.value).endsWith(search) ? 1 : 0,
            }),
          }}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      await userEvent.click(screen.getByRole('button'));
      await userEvent.click(screen.getByPlaceholderText('Search here…'));

      // '_two' matches opt_two by value suffix, opt_one does not match
      await userEvent.keyboard('_two');
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('row', {name: 'Option One'})).not.toBeInTheDocument();
    });

    it('can limit the number of options', async () => {
      render(
        <CompactSelect
          grid
          sizeLimit={2}
          sizeLimitMessage="Use search for more options…"
          search
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
            {value: 'opt_three', label: 'Option Three'},
          ]}
          value={undefined}
          onChange={jest.fn()}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));

      // only the first two options should be visible due to `sizeLimit`
      expect(screen.getByRole('row', {name: 'Option One'})).toBeInTheDocument();
      expect(screen.getByRole('row', {name: 'Option Two'})).toBeInTheDocument();
      expect(screen.queryByRole('row', {name: 'Option Three'})).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search…')).toHaveFocus();
      });
      // Option Three is not reachable via keyboard, focus wraps back to Option One
      await userEvent.keyboard(`{ArrowDown}`);
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus();
      await userEvent.keyboard(`{ArrowDown>2}`);
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus();

      // Option Three is still available via search
      await userEvent.type(screen.getByPlaceholderText('Search…'), 'three');
      expect(screen.getByRole('row', {name: 'Option Three'})).toBeInTheDocument();
    });

    it('can toggle sections', async () => {
      const mock = jest.fn();

      function Component() {
        const [state, setState] = useState<string[]>([]);

        return (
          <CompactSelect
            grid
            multiple
            onSectionToggle={mock}
            value={state}
            onChange={selection => {
              mock(selection);
              setState(selection.map(opt => opt.value));
            }}
            options={[
              {
                key: 'section-1',
                label: 'Section 1',
                showToggleAllButton: true,
                options: [
                  {value: 'opt_one', label: 'Option One'},
                  {value: 'opt_two', label: 'Option Two'},
                ],
              },
              {
                key: 'section-2',
                label: 'Section 2',
                showToggleAllButton: true,
                options: [
                  {value: 'opt_three', label: 'Option Three'},
                  {value: 'opt_four', label: 'Option Four'},
                ],
              },
            ]}
          />
        );
      }

      render(<Component />);

      // click on the trigger button
      await userEvent.click(screen.getByRole('button', {expanded: false}));
      await waitFor(() =>
        expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus()
      );

      // move focus to Section 1's toggle button and press it to select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 1'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('row', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'select'
      );

      // press Section 1's toggle button again to unselect all
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('row', {name: 'Option One'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(screen.getByRole('row', {name: 'Option Two'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-1',
          label: 'Section 1',
          showToggleAllButton: true,
          options: [
            {key: 'opt_one', value: 'opt_one', label: 'Option One'},
            {key: 'opt_two', value: 'opt_two', label: 'Option Two'},
          ],
        },
        'unselect'
      );

      // move to Section 2's toggle button and select all
      await userEvent.keyboard('{Tab}');
      expect(screen.getByRole('button', {name: 'Select All in Section 2'})).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(screen.getByRole('row', {name: 'Option Three'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('row', {name: 'Option Four'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(mock).toHaveBeenCalledWith(
        {
          key: 'section-2',
          label: 'Section 2',
          showToggleAllButton: true,
          options: [
            {key: 'opt_three', value: 'opt_three', label: 'Option Three'},
            {key: 'opt_four', value: 'opt_four', label: 'Option Four'},
          ],
        },
        'select'
      );
    });

    it('triggers onClose when the menu is closed if provided', async () => {
      const onCloseMock = jest.fn();
      render(
        <CompactSelect
          grid
          value={undefined}
          onChange={jest.fn()}
          onClose={onCloseMock}
          options={[
            {value: 'opt_one', label: 'Option One'},
            {value: 'opt_two', label: 'Option Two'},
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));
      expect(onCloseMock).not.toHaveBeenCalled();

      // close the menu
      await userEvent.click(document.body);
      await waitFor(() => {
        expect(onCloseMock).toHaveBeenCalled();
      });
    });

    it('allows keyboard navigation to nested buttons', async () => {
      const onPointerUpMock = jest.fn();
      const onKeyUpMock = jest.fn();

      render(
        <CompactSelect
          grid
          value={undefined}
          onChange={jest.fn()}
          options={[
            {
              value: 'opt_one',
              label: 'Option One',
              trailingItems: (
                <button onPointerUp={onPointerUpMock} onKeyUp={onKeyUpMock}>
                  Trailing Button One
                </button>
              ),
            },
            {
              value: 'opt_two',
              label: 'Option Two',
              trailingItems: (
                <button onPointerUp={onPointerUpMock} onKeyUp={onKeyUpMock}>
                  Trailing Button Two
                </button>
              ),
            },
          ]}
        />
      );

      // click on the trigger button
      await userEvent.click(screen.getByRole('button'));
      await waitFor(() =>
        expect(screen.getByRole('row', {name: 'Option One'})).toHaveFocus()
      );

      // press Arrow Right, focus should be moved to the trailing button
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', {name: 'Trailing Button One'})).toHaveFocus();

      // press Enter, onKeyUpMock is called
      await userEvent.keyboard('{ArrowRight}');
      expect(onKeyUpMock).toHaveBeenCalled();

      // click on Trailing Button Two, onPointerUpMock is called
      await userEvent.click(screen.getByRole('button', {name: 'Trailing Button Two'}));
      expect(onPointerUpMock).toHaveBeenCalled();
    });
  });
});
