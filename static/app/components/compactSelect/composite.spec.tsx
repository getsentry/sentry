import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CompositeSelect} from 'sentry/components/compactSelect/composite';

describe('CompactSelect', function () {
  it('renders', async function () {
    render(
      <CompositeSelect menuTitle="Menu title">
        <CompositeSelect.Region
          label="Region 1"
          defaultValue="choice_one"
          onChange={() => {}}
          options={[
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ]}
        />
        <CompositeSelect.Region
          multiple
          label="Region 2"
          defaultValue={['choice_three', 'choice_four']}
          onChange={() => {}}
          options={[
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ]}
        />
      </CompositeSelect>
    );

    // Trigger button
    const triggerButton = screen.getByRole('button', {expanded: false});
    expect(triggerButton).toBeInTheDocument();
    await userEvent.click(triggerButton);
    expect(triggerButton).toHaveAttribute('aria-expanded', 'true');

    // Menu title
    expect(screen.getByText('Menu title')).toBeInTheDocument();

    // Region 1
    expect(screen.getByRole('listbox', {name: 'Region 1'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Choice One'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Choice One'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Choice Two'})).toBeInTheDocument();

    // Region 2
    expect(screen.getByRole('listbox', {name: 'Region 2'})).toBeInTheDocument();
    expect(screen.getByRole('listbox', {name: 'Region 2'})).toHaveAttribute(
      'aria-multiselectable',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Choice Three'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Choice Three'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Choice Four'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Choice Four'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('renders disabled trigger button', function () {
    render(
      <CompositeSelect disabled>
        <CompositeSelect.Region
          label="Region 1"
          onChange={() => {}}
          options={[
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ]}
        />
      </CompositeSelect>
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  // CompositeSelect renders a series of separate list boxes, each of which has its own
  // focus state. This test ensures that focus moves seamlessly between regions.
  it('manages focus between regions', async function () {
    render(
      <CompositeSelect>
        <CompositeSelect.Region
          label="Region 1"
          onChange={() => {}}
          options={[
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ]}
        />
        <CompositeSelect.Region
          multiple
          label="Region 2"
          onChange={() => {}}
          options={[
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ]}
        />
      </CompositeSelect>
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('button'));

    // first option is focused
    await waitFor(() =>
      expect(screen.getByRole('option', {name: 'Choice One'})).toHaveFocus()
    );

    // press arrow down and second option gets focus
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', {name: 'Choice Two'})).toHaveFocus();

    // press arrow down again and third option in the second region gets focus
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', {name: 'Choice Three'})).toHaveFocus();

    // press arrow up and second option in the first region gets focus
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', {name: 'Choice Two'})).toHaveFocus();

    // press arrow down 3 times and focus moves to the third and fourth option, before
    // wrapping back to the first option
    await userEvent.keyboard('{ArrowDown>3}');
    expect(screen.getByRole('option', {name: 'Choice One'})).toHaveFocus();
  });

  it('has separate, async self-contained select regions', async function () {
    const region1Mock = jest.fn();
    const region2Mock = jest.fn();
    render(
      <CompositeSelect>
        <CompositeSelect.Region
          label="Region 1"
          onChange={region1Mock}
          options={[
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ]}
        />
        <CompositeSelect.Region
          multiple
          label="Region 2"
          onChange={region2Mock}
          options={[
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ]}
        />
      </CompositeSelect>
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('button'));

    // select Choice One
    await userEvent.click(screen.getByRole('option', {name: 'Choice One'}));

    // Region 1's callback is called, and trigger label is updated
    expect(region1Mock).toHaveBeenCalledWith({value: 'choice_one', label: 'Choice One'});
    expect(screen.getByRole('button', {name: 'Choice One'})).toBeInTheDocument();

    // open the menu again
    await userEvent.click(screen.getByRole('button'));

    // in the first region, only Choice One is selected
    expect(screen.getByRole('option', {name: 'Choice One'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'Choice Two'})).toHaveAttribute(
      'aria-selected',
      'false'
    );

    // the second region isn't affected, nothing is selected
    expect(screen.getByRole('option', {name: 'Choice Three'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('option', {name: 'Choice Four'})).toHaveAttribute(
      'aria-selected',
      'false'
    );

    // select Choice Three
    await userEvent.click(screen.getByRole('option', {name: 'Choice Three'}));

    // Choice Three is marked as selected, callback is called, and trigger button updated
    expect(screen.getByRole('option', {name: 'Choice Three'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(region2Mock).toHaveBeenCalledWith([
      {value: 'choice_three', label: 'Choice Three'},
    ]);
    expect(screen.getByRole('button', {name: 'Choice One +1'})).toBeInTheDocument();
  });

  it('can search', async function () {
    render(
      <CompositeSelect searchable searchPlaceholder="Search placeholder…">
        <CompositeSelect.Region
          label="Region 1"
          onChange={() => {}}
          options={[
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ]}
        />
        <CompositeSelect.Region
          multiple
          label="Region 2"
          onChange={() => {}}
          options={[
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ]}
        />
      </CompositeSelect>
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('button'));

    // type 'Two' into the search box
    await userEvent.click(screen.getByPlaceholderText('Search placeholder…'));
    await userEvent.keyboard('Two');

    // only Option Two should be available
    expect(screen.getByRole('option', {name: 'Choice Two'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Choice One'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Choice Three'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Choice Four'})).not.toBeInTheDocument();

    // Region 2's label isn't rendered because the region is empty
    expect(screen.queryByRole('Region 2')).not.toBeInTheDocument();
  });

  it('works with grid lists', async function () {
    render(
      <CompositeSelect grid>
        <CompositeSelect.Region
          label="Region 1"
          defaultValue="choice_one"
          onChange={() => {}}
          options={[
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ]}
        />
        <CompositeSelect.Region
          multiple
          label="Region 2"
          onChange={() => {}}
          options={[
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ]}
        />
      </CompositeSelect>
    );

    // click on the trigger button
    await userEvent.click(screen.getByRole('button'));

    // Region 1 is rendered & Choice One is selected
    expect(screen.getByRole('grid', {name: 'Region 1'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Choice One'})).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('row', {name: 'Choice One'})).toHaveFocus()
    );
    expect(screen.getByRole('row', {name: 'Choice One'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('row', {name: 'Choice Two'})).toBeInTheDocument();

    // Region 2  is rendered
    expect(screen.getByRole('grid', {name: 'Region 2'})).toBeInTheDocument();
    expect(screen.getByRole('grid', {name: 'Region 2'})).toHaveAttribute(
      'aria-multiselectable',
      'true'
    );
    expect(screen.getByRole('row', {name: 'Choice Three'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'Choice Four'})).toBeInTheDocument();

    // Pressing Arrow Down twice moves focus to Choice Three
    await userEvent.keyboard('{ArrowDown>2}');
    expect(screen.getByRole('row', {name: 'Choice Three'})).toHaveFocus();

    // Pressing Enter selects Choice Three
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('row', {name: 'Choice Three'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Pressing Arrow Down two more times loops focus back to Choice One
    await userEvent.keyboard('{ArrowDown>2}');
    expect(screen.getByRole('row', {name: 'Choice One'})).toHaveFocus();
  });
});
