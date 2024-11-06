import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EAPField from 'sentry/views/alerts/rules/metric/eapField';

describe('EAPField', () => {
  const organization = OrganizationFixture();
  let fieldsMock;

  beforeEach(() => {
    fieldsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
    });
  });

  it('renders', () => {
    render(<EAPField aggregate={'count(span.duration)'} onChange={() => {}} />);
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        query: expect.objectContaining({type: 'number'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        query: expect.objectContaining({type: 'string'}),
      })
    );
    screen.getByText('count');
    screen.getByText('span.duration');
  });

  it('should call onChange with the new aggregate string when switching aggregates', async () => {
    const onChange = jest.fn();
    render(<EAPField aggregate={'count(span.duration)'} onChange={onChange} />);
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        query: expect.objectContaining({type: 'number'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/spans/fields/`,
      expect.objectContaining({
        query: expect.objectContaining({type: 'string'}),
      })
    );
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('max'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('max(span.duration)', {}));
  });
});
