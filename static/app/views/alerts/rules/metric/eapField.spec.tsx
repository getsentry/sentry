import {useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EAPField from 'sentry/views/alerts/rules/metric/eapField';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
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
        <EAPField
          aggregate="count(span.duration)"
          onChange={() => {}}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
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
        <EAPField
          aggregate="epm()"
          onChange={() => {}}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number', itemType: 'spans'}),
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
        <EAPField
          aggregate="failure_rate()"
          onChange={() => {}}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number', itemType: 'spans'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string', itemType: 'spans'}),
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
        <EAPField
          aggregate="count(span.duration)"
          onChange={onChange}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
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
        query: expect.objectContaining({attributeType: 'string', itemType: 'spans'}),
      })
    );
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('max'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('max(span.duration)', {}));
  });

  it('should switch back to count(span.duration) when using count', async () => {
    function Component() {
      const [aggregate, setAggregate] = useState('count(span.duration)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <EAPField
            aggregate={aggregate}
            onChange={setAggregate}
            eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
          />
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

  it('defaults count_unique argument to span.op', async () => {
    function Component() {
      const [aggregate, setAggregate] = useState('count(span.duration)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <EAPField
            aggregate={aggregate}
            onChange={setAggregate}
            eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
          />
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

  it('renders count with argument disabled for logs', () => {
    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
        <EAPField
          aggregate="count(message)"
          onChange={() => {}}
          eventTypes={[EventTypes.TRACE_ITEM_LOG]}
        />
      </TraceItemAttributeProvider>
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number', itemType: 'logs'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string', itemType: 'logs'}),
      })
    );
    expect(screen.getByText('count')).toBeInTheDocument();
    expect(screen.getByText('logs')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    // this corresponds to the `count` input
    expect(inputs[0]).toBeEnabled();
    // this corresponds to the `spans` input
    expect(inputs[1]).toBeDisabled();
  });
  it('renders count_unique with string arguments for logs', async () => {
    function Component() {
      const [aggregate, setAggregate] = useState('count(message)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <EAPField
            aggregate={aggregate}
            onChange={setAggregate}
            eventTypes={[EventTypes.TRACE_ITEM_LOG]}
          />
        </TraceItemAttributeProvider>
      );
    }

    render(<Component />);

    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number', itemType: 'logs'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string', itemType: 'logs'}),
      })
    );
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('count_unique'));

    expect(screen.getByText('count_unique')).toBeInTheDocument();
    await userEvent.click(screen.getByText('message'));
    expect(screen.getByText('severity')).toBeInTheDocument();
  });
  it('renders numeric aggregates with numeric arguments for logs', async () => {
    function Component() {
      const [aggregate, setAggregate] = useState('count(message)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <EAPField
            aggregate={aggregate}
            onChange={setAggregate}
            eventTypes={[EventTypes.TRACE_ITEM_LOG]}
          />
        </TraceItemAttributeProvider>
      );
    }

    render(<Component />);

    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'number', itemType: 'logs'}),
      })
    );
    expect(fieldsMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trace-items/attributes/`,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'string', itemType: 'logs'}),
      })
    );
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('sum'));

    expect(screen.getByText('sum')).toBeInTheDocument();
    expect(screen.getByText('severity_number')).toBeInTheDocument();
  });

  it('renders apdex with duration argument and threshold value for spans', async () => {
    function Component() {
      const [aggregate, setAggregate] = useState('count(span.duration)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <EAPField
            aggregate={aggregate}
            onChange={setAggregate}
            eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
          />
        </TraceItemAttributeProvider>
      );
    }

    render(<Component />);

    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('apdex'));

    expect(screen.getByText('apdex')).toBeInTheDocument();
    expect(screen.getByText('span.duration')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(3);
    expect(inputs[0]).toBeEnabled();
    expect(inputs[1]).toBeEnabled();
    expect(inputs[2]).toBeEnabled();
    expect(inputs[2]).toHaveValue('300');
  });

  it('should call onChange with correct apdex aggregate when switching to apdex', async () => {
    const onChange = jest.fn();
    render(
      <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
        <EAPField
          aggregate="count(span.duration)"
          onChange={onChange}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      </TraceItemAttributeProvider>
    );

    await userEvent.click(screen.getByText('count'));
    await userEvent.click(await screen.findByText('apdex'));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith('apdex(span.duration,300)', {})
    );
  });

  it('should allow changing both duration argument and threshold value for apdex', async () => {
    const onChange = jest.fn();

    function Component() {
      const [aggregate, setAggregate] = useState('apdex(span.duration,300)');
      return (
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
          <EAPField
            aggregate={aggregate}
            onChange={newAggregate => {
              setAggregate(newAggregate);
              onChange(newAggregate, {});
            }}
            eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
          />
        </TraceItemAttributeProvider>
      );
    }

    render(<Component />);

    expect(screen.getByText('apdex')).toBeInTheDocument();
    expect(screen.getByText('span.duration')).toBeInTheDocument();

    const inputs = screen.getAllByRole('textbox');
    expect(inputs[2]).toHaveValue('300');

    await userEvent.click(screen.getByText('span.duration'));
    await userEvent.click(await screen.findByText('span.self_time'));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('apdex(span.self_time,300)', {});
    });

    expect(screen.getByText('span.self_time')).toBeInTheDocument();

    const thresholdInput = screen.getAllByRole('textbox')[2]!;
    await userEvent.clear(thresholdInput);
    await userEvent.type(thresholdInput, '500');
    await userEvent.keyboard('{Tab}');

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('apdex(span.self_time,500)', {});
    });

    expect(thresholdInput).toHaveValue('500');
  });
});
