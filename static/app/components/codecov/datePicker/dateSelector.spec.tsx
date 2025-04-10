import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateSelector} from 'sentry/components/codecov/datePicker/dateSelector';
import ConfigStore from 'sentry/stores/configStore';

const {router} = initializeOrg({
  router: {
    location: {
      pathname: '/codecov/tests/',
      query: {},
    },
    params: {},
  },
});

describe('DateSelector', function () {
  const onChange = jest.fn();

  function getComponent(props = {}) {
    return <DateSelector onChange={onChange} {...props} />;
  }

  function renderComponent(props = {}) {
    return render(getComponent(props), {router});
  }

  beforeEach(function () {
    ConfigStore.loadInitialData(
      ConfigFixture({
        user: UserFixture({
          options: {...UserFixture().options, timezone: 'America/New_York'},
        }),
      })
    );
    onChange.mockReset();
  });

  it('renders when given relative period', async function () {
    renderComponent({relative: '7d'});
    expect(await screen.findByRole('button', {name: '7D'})).toBeInTheDocument();
  });

  it('renders when given an invalid relative period', async function () {
    render(<DateSelector relative="1y" />, {router});
    expect(
      await screen.findByRole('button', {name: 'Invalid Period'})
    ).toBeInTheDocument();
  });
});
