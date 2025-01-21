import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import EAPField from 'sentry/views/alerts/rules/metric/eapField';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

describe('EAPField', () => {
  const organization = OrganizationFixture();
  let fieldsMock: any;

  beforeEach(() => {
    fieldsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      method: 'GET',
    });
  });

  it('renders', () => {
    render(
      <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
        <EAPField aggregate={'count(span.duration)'} onChange={() => {}} />
      </SpanTagsProvider>
    );
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
    render(
      <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
        <EAPField aggregate={'count(span.duration)'} onChange={onChange} />
      </SpanTagsProvider>
    );
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
