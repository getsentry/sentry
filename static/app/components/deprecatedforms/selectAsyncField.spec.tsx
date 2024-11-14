import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import Form from 'sentry/components/deprecatedforms/form';
import SelectAsyncField from 'sentry/components/deprecatedforms/selectAsyncField';

describe('SelectAsyncField', function () {
  let api: jest.Mock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    api = MockApiClient.addMockResponse({
      url: '/foo/bar/',
      body: {
        fieldName: [{id: 'baz', text: 'Baz Label'}],
      },
    });
  });

  const defaultProps = {
    url: '/foo/bar/',
    name: 'fieldName',
    label: 'Select me',
  };

  it('supports autocomplete arguments from an integration', async function () {
    render(<SelectAsyncField {...defaultProps} />);

    await selectEvent.openMenu(screen.getByText('Select me'));
    await userEvent.type(screen.getByRole('textbox'), 'baz');

    expect(api).toHaveBeenCalled();

    // Is in select menu
    await screen.findByText('Baz Label');
  });

  it('with Form context', async function () {
    const submitMock = jest.fn();
    render(
      <Form onSubmit={submitMock} aria-label="form">
        <SelectAsyncField {...defaultProps} />
      </Form>
    );

    await selectEvent.openMenu(screen.getByText('Select me'));
    await userEvent.type(screen.getByRole('textbox'), 'baz');
    await userEvent.click(screen.getByText('Baz Label'));

    expect(screen.getByLabelText('form')).toHaveFormValues({
      fieldName: 'baz',
    });

    await userEvent.click(screen.getByRole('button', {name: /save/i}));

    expect(submitMock).toHaveBeenCalledWith(
      {
        fieldName: 'baz',
      },
      expect.anything(),
      expect.anything()
    );
  });
});
