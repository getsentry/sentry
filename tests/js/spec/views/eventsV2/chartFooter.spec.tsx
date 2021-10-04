import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {t} from 'app/locale';
import {DisplayModes} from 'app/utils/discover/types';
import ChartFooter from 'app/views/eventsV2/chartFooter';

describe('EventsV2 > ChartFooter', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()', 'failure_count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
  ];

  afterEach(function () {});

  it('renders yAxis option using OptionSelector using only the first yAxisValue without feature flag', async function () {
    // @ts-expect-error
    const organization = TestStubs.Organization({
      features,
      // @ts-expect-error
      projects: [TestStubs.Project()],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const wrapper = mountWithTheme(
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        topEvents="5"
      />,
      initialData.routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    const optionSelector = wrapper.find('OptionSelector').last();
    expect(optionSelector.props().title).toEqual(t('Y-Axis'));
    expect(optionSelector.props().selected).toEqual(yAxisValue[0]);
  });

  it('renders yAxis option using OptionCheckboxSelector using entire yAxisValue with feature flag', async function () {
    // @ts-expect-error
    const organization = TestStubs.Organization({
      features: [...features, 'connect-discover-and-dashboards'],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const wrapper = mountWithTheme(
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.DEFAULT}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        topEvents="5"
      />,
      initialData.routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    const optionCheckboxSelector = wrapper.find('OptionCheckboxSelector').last();
    expect(optionCheckboxSelector.props().title).toEqual(t('Y-Axis'));
    expect(optionCheckboxSelector.props().selected).toEqual(yAxisValue);
  });

  it('renders display limits with default limit when top 5 mode is selected', async function () {
    // @ts-expect-error
    const organization = TestStubs.Organization({
      features: [...features, 'discover-top-events'],
    });

    // Start off with an invalid view (empty is invalid)
    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {query: 'tag:value'}},
      },
      project: 1,
      projects: [],
    });

    const wrapper = mountWithTheme(
      <ChartFooter
        organization={organization}
        total={100}
        yAxisValue={yAxisValue}
        yAxisOptions={yAxisOptions}
        onAxisChange={() => undefined}
        displayMode={DisplayModes.TOP5}
        displayOptions={[{label: DisplayModes.DEFAULT, value: DisplayModes.DEFAULT}]}
        onDisplayChange={() => undefined}
        onTopEventsChange={() => undefined}
        topEvents="5"
      />,
      initialData.routerContext
    );

    // @ts-expect-error
    await tick();
    wrapper.update();

    const optionSelector = wrapper.find('OptionSelector[title="Limit"]');
    expect(optionSelector.props().selected).toEqual('5');
  });
});
