import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';
import SamplingModal from 'sentry/views/performance/landing/samplingModal';

const initializeData = () => {
  const data = _initializeData({
    query: {statsPeriod: '7d', environment: ['prod'], project: [-42]},
  });

  data.eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return data;
};

const stubEl: any = (props: any) => <div>{props.children}</div>;

function WrappedComponent({data}: any) {
  const eventView = EventView.fromLocation(data.router.location);

  return (
    <OrganizationContext.Provider value={data.organization}>
      <MEPSettingProvider>
        <SamplingModal
          Header={stubEl}
          Footer={stubEl}
          Body={stubEl}
          CloseButton={stubEl}
          eventView={eventView}
          organization={data.organization}
          onApply={() => {}}
          closeModal={() => void 0}
          projects={data.projects}
          isMEPEnabled={data.isMEPEnabled}
        />
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
}

describe('Performance > Landing > SamplingModal', function () {
  let wrapper: any;

  act(() => void TeamStore.loadInitialData([], false, null));

  afterEach(function () {
    if (wrapper) {
      wrapper.unmount();
      wrapper = undefined;
    }
  });

  it('renders sampling modal', async function () {
    const data = initializeData();

    wrapper = render(<WrappedComponent data={data} />);

    expect(await screen.findByLabelText('Always show sampled data')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Automatically switch to sampled data when required')
    ).toBeInTheDocument();
  });
});
