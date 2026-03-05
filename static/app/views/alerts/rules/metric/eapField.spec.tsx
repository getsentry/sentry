import {useState, type ReactElement} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EAPField from 'sentry/views/alerts/rules/metric/eapField';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';

describe('EAPField', () => {
  const organization = OrganizationFixture({features: ['visibility-explore-view']});
  let fieldsMock: any;

  function renderWithVisibilityFeature(ui: ReactElement) {
    return render(ui, {organization});
  }

  beforeEach(() => {
    fieldsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
    });
  });

  it('does not fetch trace item attributes without visibility-explore-view', () => {
    const orgWithoutVisibilityFeature = OrganizationFixture({
      slug: 'no-visibility-org',
      features: [],
    });
    const noVisibilityFieldsMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgWithoutVisibilityFeature.slug}/trace-items/attributes/`,
      method: 'GET',
    });

    render(
      <EAPField
        aggregate="count(span.duration)"
        onChange={() => {}}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
      />,
      {organization: orgWithoutVisibilityFeature}
    );

    expect(noVisibilityFieldsMock).not.toHaveBeenCalled();
  });

  it('renders', () => {
    renderWithVisibilityFeature(
      <EAPField
        aggregate="count(span.duration)"
        onChange={() => {}}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
      />
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
    renderWithVisibilityFeature(
      <EAPField
        aggregate="epm()"
        onChange={() => {}}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
      />
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
    renderWithVisibilityFeature(
      <EAPField
        aggregate="failure_rate()"
        onChange={() => {}}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
      />
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
    renderWithVisibilityFeature(
      <EAPField
        aggregate="count(span.duration)"
        onChange={onChange}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
      />
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
        <EAPField
          aggregate={aggregate}
          onChange={setAggregate}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      );
    }

    renderWithVisibilityFeature(<Component />);

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
        <EAPField
          aggregate={aggregate}
          onChange={setAggregate}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      );
    }

    renderWithVisibilityFeature(<Component />);

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
    renderWithVisibilityFeature(
      <EAPField
        aggregate="count(message)"
        onChange={() => {}}
        eventTypes={[EventTypes.TRACE_ITEM_LOG]}
      />
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
        <EAPField
          aggregate={aggregate}
          onChange={setAggregate}
          eventTypes={[EventTypes.TRACE_ITEM_LOG]}
        />
      );
    }

    renderWithVisibilityFeature(<Component />);

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
        <EAPField
          aggregate={aggregate}
          onChange={setAggregate}
          eventTypes={[EventTypes.TRACE_ITEM_LOG]}
        />
      );
    }

    renderWithVisibilityFeature(<Component />);

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
        <EAPField
          aggregate={aggregate}
          onChange={setAggregate}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      );
    }

    renderWithVisibilityFeature(<Component />);

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
    renderWithVisibilityFeature(
      <EAPField
        aggregate="count(span.duration)"
        onChange={onChange}
        eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
      />
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
        <EAPField
          aggregate={aggregate}
          onChange={newAggregate => {
            setAggregate(newAggregate);
            onChange(newAggregate, {});
          }}
          eventTypes={[EventTypes.TRACE_ITEM_SPAN]}
        />
      );
    }

    renderWithVisibilityFeature(<Component />);

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
