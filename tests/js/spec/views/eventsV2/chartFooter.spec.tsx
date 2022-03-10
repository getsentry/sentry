import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {t} from 'sentry/locale';
import {DisplayModes} from 'sentry/utils/discover/types';
import ChartFooter from 'sentry/views/eventsV2/chartFooter';

describe('EventsV2 > ChartFooter', function () {
  const features = ['discover-basic'];
  const yAxisValue = ['count()', 'failure_count()'];
  const yAxisOptions = [
    {label: 'count()', value: 'count()'},
    {label: 'failure_count()', value: 'failure_count()'},
  ];

  afterEach(function () {});

  it('renders yAxis option using OptionCheckboxSelector using entire yAxisValue', async function () {
    const organization = TestStubs.Organization({
      features: [...features],
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

    await tick();
    wrapper.update();

    const optionCheckboxSelector = wrapper.find('OptionCheckboxSelector').last();
    expect(optionCheckboxSelector.props().title).toEqual(t('Y-Axis'));
    expect(optionCheckboxSelector.props().selected).toEqual(yAxisValue);
  });

  it('renders display limits with default limit when top 5 mode is selected', async function () {
    const organization = TestStubs.Organization({
      features,
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

    await tick();
    wrapper.update();

    const optionSelector = wrapper.find('OptionSelector[title="Limit"]');
    expect(optionSelector.props().selected).toEqual('5');
  });
});
