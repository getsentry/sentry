import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SelectAsyncField} from 'sentry/components/forms/fields/selectAsyncField';
import {Form} from 'sentry/components/forms/form';

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
});
