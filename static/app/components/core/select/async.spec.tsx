import {SelectAsync} from '@sentry/scraps/select';

import {SelectAsyncField} from 'sentry/components/forms/fields/selectAsyncField';
import {Form} from 'sentry/components/forms/form';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

describe('SelectAsync', () => {
  it('calls onResults once per completed request, not on every render', async () => {
    MockApiClient.addMockResponse({
      url: '/probe/',
      body: [{id: '1', name: 'foo'}],
    });

    const onResults = jest.fn((data: any) =>
      data.map((d: any) => ({value: d.id, label: d.name}))
    );

    render(
      <Form onSubmit={() => {}}>
        <SelectAsyncField
          name="probe"
          url="/probe/"
          value={undefined}
          onQuery={(q: any) => ({query: q})}
          onResults={onResults}
        />
      </Form>
    );

    await waitFor(() => expect(onResults).toHaveBeenCalledTimes(1));

    // A parent re-render (e.g. from typing, which is unrelated to this field)
    // must not re-invoke onResults again for the same data.
    await userEvent.click(screen.getByRole('textbox'));
    expect(onResults).toHaveBeenCalledTimes(1);
  });

  it('shows defaultOptions immediately when it is an array, before any fetch resolves', async () => {
    MockApiClient.addMockResponse({url: '/probe/', body: []});

    render(
      <SelectAsync
        url="/probe/"
        value={undefined}
        onQuery={(q: any) => ({query: q})}
        onResults={(data: any) => data}
        defaultOptions={[{value: 'seed', label: 'Seeded option'}]}
      />
    );

    await selectEvent.openMenu(screen.getByRole('textbox'));
    expect(
      await screen.findByRole('menuitemradio', {name: 'Seeded option'})
    ).toBeInTheDocument();
  });

  it('does not show a perpetual loading state when defaultOptions is false and input is empty', () => {
    MockApiClient.addMockResponse({url: '/probe/', body: []});

    render(
      <SelectAsync
        url="/probe/"
        value={undefined}
        onQuery={(q: any) => ({query: q})}
        onResults={(data: any) => data}
        defaultOptions={false}
      />
    );

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('clears stale options when the query becomes disabled again', async () => {
    MockApiClient.addMockResponse({
      url: '/probe/',
      body: [{id: '1', name: 'foo-option'}],
    });

    render(
      <SelectAsync
        url="/probe/"
        value={undefined}
        onQuery={(q: any) => ({query: q})}
        onResults={(data: any) => data.map((d: any) => ({value: d.id, label: d.name}))}
        defaultOptions={false}
      />
    );

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'foo');
    await selectEvent.openMenu(input);
    expect(
      await screen.findByRole('menuitemradio', {name: 'foo-option'})
    ).toBeInTheDocument();

    // Clearing the input disables the query again (defaultOptions={false}),
    // so the previous search's results must not linger.
    await userEvent.clear(input);
    await waitFor(() =>
      expect(
        screen.queryByRole('menuitemradio', {name: 'foo-option'})
      ).not.toBeInTheDocument()
    );
  });
});
