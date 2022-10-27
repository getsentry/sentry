import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CompactSelect from 'sentry/components/compactSelect';

describe('CompactSelect', function () {
  it('renders', function () {
    const {container} = render(
      <CompactSelect
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(container).toSnapshot();
  });

  it('renders disabled', function () {
    render(
      <CompactSelect
        isDisabled
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders with menu title', function () {
    render(
      <CompactSelect
        menuTitle="Menu title"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // click on the trigger button
    userEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Menu title')).toBeInTheDocument();
  });

  it('updates trigger label on selection', function () {
    const mock = jest.fn();
    render(
      <CompactSelect
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
        onChange={mock}
      />
    );

    // click on the trigger button
    userEvent.click(screen.getByRole('button'));

    // select Option One
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Option One'}));

    expect(mock).toHaveBeenCalledWith({value: 'opt_one', label: 'Option One'});
    expect(screen.getByRole('button', {name: 'Option One'})).toBeInTheDocument();
  });

  it('can select multiple options', function () {
    const mock = jest.fn();
    render(
      <CompactSelect
        multiple
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
        onChange={mock}
      />
    );

    // click on the trigger button
    userEvent.click(screen.getByRole('button'));

    // select Option One & Option Two
    userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Option One'}));
    userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Option Two'}));

    expect(mock).toHaveBeenCalledWith([
      {value: 'opt_one', label: 'Option One'},
      {value: 'opt_two', label: 'Option Two'},
    ]);
    expect(screen.getByRole('button', {name: 'Option One +1'})).toBeInTheDocument();
  });

  it('displays trigger button with prefix', function () {
    render(
      <CompactSelect
        triggerProps={{prefix: 'Prefix'}}
        value="opt_one"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );
    expect(screen.getByRole('button', {name: 'Prefix Option One'})).toBeInTheDocument();
  });

  it('can search', function () {
    render(
      <CompactSelect
        isSearchable
        placeholder="Search here…"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // click on the trigger button
    userEvent.click(screen.getByRole('button'));

    // type 'Two' into the search box
    userEvent.click(screen.getByText('Search here…'));
    userEvent.keyboard('Two');

    // only Option Two should be available, Option One should be filtered out
    expect(screen.getByRole('menuitemradio', {name: 'Option Two'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Option One'})
    ).not.toBeInTheDocument();
  });

  it('triggers onClose when the menu is closed if provided', function () {
    const onCloseMock = jest.fn();
    render(
      <CompactSelect
        isSearchable
        onClose={onCloseMock}
        placeholder="Search here…"
        options={[
          {value: 'opt_one', label: 'Option One'},
          {value: 'opt_two', label: 'Option Two'},
        ]}
      />
    );

    // click on the trigger button
    userEvent.click(screen.getByRole('button'));
    expect(onCloseMock).not.toHaveBeenCalled();

    // close the menu
    userEvent.keyboard('{esc}');
    expect(onCloseMock).toHaveBeenCalled();
  });
});
