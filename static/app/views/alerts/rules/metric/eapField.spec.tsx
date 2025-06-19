import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EAPField from 'sentry/views/alerts/rules/metric/eapField';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('EAPField', () => {
  const organization = OrganizationFixture();
  let fieldsMock: any;

  beforeEach(() => {
    fieldsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
    });
  });

  it('renders', () => {
    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <EAPField aggregate={'count(span.duration)'} onChange={() => {}} />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string'}),
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

  it('renders epm with argument disabled', () => {
    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <EAPField aggregate={'epm()'} onChange={() => {}} />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string'}),
      })
    );
    expect(screen.getByText('epm')).toBeInTheDocument();
    expect(screen.getByText('spans')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    // this corresponds to the `count` input
    expect(inputs[0]).toBeEnabled();
    // this corresponds to the `spans` input
    expect(inputs[1]).toBeDisabled();
  });

  it('renders failure_rate with argument disabled', () => {
    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <EAPField aggregate={'failure_rate()'} onChange={() => {}} />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string'}),
      })
    );
    expect(screen.getByText('failure_rate')).toBeInTheDocument();
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
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <EAPField aggregate={'count(span.duration)'} onChange={onChange} />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string'}),
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
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <EAPField aggregate={aggregate} onChange={setAggregate} />
        </TraceItemAttributeProvider>
      );
    }

    render(<Component />);

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

  it('defaults count_unique argument to span.op', async function () {
    function Component() {
      const [aggregate, setAggregate] = useState('count(span.duration)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <EAPField aggregate={aggregate} onChange={setAggregate} />
        </TraceItemAttributeProvider>
      );
    }

    render(<Component />);

    // switch from count(spans) -> count_unique(span.op)
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('count_unique'));
    expect(screen.getByText('count_unique')).toBeInTheDocument();
    expect(screen.getByText('span.op')).toBeInTheDocument();

    // switch from count_unique(span.op) -> avg(span.self_time)
    await userEvent.click(screen.getByText('count_unique'));
    await userEvent.click(await screen.findByText('avg'));
    await userEvent.click(screen.getByText('span.duration'));
    await userEvent.click(await screen.findByText('span.self_time'));
    expect(screen.getByText('avg')).toBeInTheDocument();
    expect(screen.getByText('span.self_time')).toBeInTheDocument();

    // switch from avg(span.self_time) -> count_unique(span.op)
    await userEvent.click(screen.getByText('avg'));
    await userEvent.click(await screen.findByText('count_unique'));
    expect(screen.getByText('count_unique')).toBeInTheDocument();
    expect(screen.getByText('span.op')).toBeInTheDocument();
  });
});
