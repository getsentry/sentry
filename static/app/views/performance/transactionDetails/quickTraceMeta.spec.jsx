import {Event} from 'fixtures/js-stubs/event';
import {Project} from 'fixtures/js-stubs/project';
import {Organization} from 'fixtures/js-stubs/organization';
import {routerContext} from 'fixtures/js-stubs/routerContext';
import {mountWithTheme} from 'sentry-test/enzyme';

import {OrganizationContext} from 'sentry/views/organizationContext';
import QuickTraceMeta from 'sentry/views/performance/transactionDetails/quickTraceMeta';

const WrappedQuickTraceMeta = ({organization, ...rest}) => {
  return (
    <OrganizationContext.Provider value={organization}>
      <QuickTraceMeta {...rest} />
    </OrganizationContext.Provider>
  );
};

describe('QuickTraceMeta', function () {
  const routerContext = routerContext();
  const location = routerContext.context.location;
  const organization = Organization({features: ['performance-view']});
  const project = Project({platform: 'javascript'});
  const event = Event({contexts: {trace: {trace_id: 'a'.repeat(32)}}});
  const emptyQuickTrace = {
    isLoading: false,
    error: null,
    trace: [],
    type: 'empty',
    currentEvent: null,
  };
  const emptyTraceMeta = {
    projects: 0,
    transactions: 0,
    errors: 0,
  };

  it('renders basic UI', async function () {
    const wrapper = mountWithTheme(
      <WrappedQuickTraceMeta
        event={event}
        project={project}
        organization={organization}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MetaData').exists()).toBe(true);
    expect(wrapper.find('div[data-test-id="quick-trace-body"] QuickTrace').exists()).toBe(
      true
    );
    expect(wrapper.find('div[data-test-id="quick-trace-footer"]').text()).toEqual(
      `View Full Trace: ${'a'.repeat(8)} (0 events)`
    );
  });

  it('renders placeholder while loading', async function () {
    const wrapper = mountWithTheme(
      <WrappedQuickTraceMeta
        event={event}
        project={project}
        organization={organization}
        location={location}
        quickTrace={{
          ...emptyQuickTrace,
          isLoading: true,
        }}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MetaData').exists()).toBe(true);
    expect(
      wrapper.find('div[data-test-id="quick-trace-body"] Placeholder').exists()
    ).toBe(true);
    expect(wrapper.find('div[data-test-id="quick-trace-footer"]').text()).toEqual(
      `View Full Trace: ${'a'.repeat(8)} (0 events)`
    );
  });

  it('renders errors', async function () {
    const wrapper = mountWithTheme(
      <WrappedQuickTraceMeta
        event={event}
        project={project}
        organization={organization}
        location={location}
        quickTrace={{
          ...emptyQuickTrace,
          error: 'something bad',
        }}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MetaData').exists()).toBe(true);
    expect(wrapper.find('div[data-test-id="quick-trace-body"]').text()).toEqual('\u2014');
    expect(wrapper.find('div[data-test-id="quick-trace-footer"]').text()).toEqual(
      `View Full Trace: ${'a'.repeat(8)} (0 events)`
    );
  });

  it('renders missing trace when trace id is not present', async function () {
    const newEvent = Event();
    const wrapper = mountWithTheme(
      <WrappedQuickTraceMeta
        event={newEvent}
        project={project}
        organization={organization}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MetaData').exists()).toBe(true);
    expect(wrapper.find('div[data-test-id="quick-trace-body"]').text()).toEqual(
      'Missing Trace'
    );
    expect(wrapper.find('div[data-test-id="quick-trace-footer"]').text()).toEqual(
      'Read the docs'
    );
  });

  it('renders missing trace with hover card when feature disabled', async function () {
    const newEvent = Event();
    const newOrg = Organization();
    const wrapper = mountWithTheme(
      <WrappedQuickTraceMeta
        event={newEvent}
        project={project}
        organization={newOrg}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('MetaData').exists()).toBe(true);
    expect(wrapper.find('div[data-test-id="quick-trace-body"]').text()).toEqual(
      'Missing Trace'
    );
    expect(wrapper.find('div[data-test-id="quick-trace-footer"]').text()).toEqual(
      'Read the docs'
    );
    expect(
      wrapper.find('div[data-test-id="quick-trace-footer"] Hovercard').exists()
    ).toEqual(true);
  });

  it('does not render when platform does not support tracing', async function () {
    const newProject = Project();
    const newEvent = Event();
    const wrapper = mountWithTheme(
      <WrappedQuickTraceMeta
        event={newEvent}
        project={newProject}
        organization={organization}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.isEmptyRender()).toBe(true);
  });
});
