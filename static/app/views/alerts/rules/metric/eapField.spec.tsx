import {useState} from 'react';
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
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('spans')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    // this corresponds to the `count` input
    expect(inputs[0]).toBeEnabled();
    // this corresponds to the `spans` input
    expect(inputs[1]).toBeDisabled();
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

  it('should switch back to count(span.duration) when using count', async function () {
    function Component() {
      const [aggregate, setAggregate] = useState('count(span.duration)');
      return (
        <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
          <EAPField aggregate={aggregate} onChange={setAggregate} />
        </SpanTagsProvider>
      );
    }

    render(<Component />);
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

    // switch from count(spans) -> max(span.duration)
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('max'));
    expect(screen.getByText('max')).toBeInTheDocument();

    // switch from max(span.duration) -> max(span.self_time)
    await userEvent.click(screen.getByText('span.duration'));
    await userEvent.click(await screen.findByText('span.self_time'));
    expect(screen.getByText('span.self_time')).toBeInTheDocument();

    // switch from max(span.self_time) -> count(spans)
    await userEvent.click(screen.getByText('max'));
    await userEvent.click(await screen.findByText('count'));
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('spans')).toBeInTheDocument();
  });
});
