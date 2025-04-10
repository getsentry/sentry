import {ConfigFixture} from 'sentry-fixture/config';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DateSelector} from 'sentry/components/codecov/datePicker/dateSelector';
import ConfigStore from 'sentry/stores/configStore';

const {organization, router} = initializeOrg({
  organization: {features: ['global-views', 'open-membership']},
  projects: [
    {id: '1', slug: 'project-1', isMember: true},
    {id: '2', slug: 'project-2', isMember: true},
    {id: '3', slug: 'project-3', isMember: false},
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/issues/',
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
    render(<DateSelector relative="1y" />, {router, organization});
    expect(
      await screen.findByRole('button', {name: 'Invalid Period'})
    ).toBeInTheDocument();
  });
});
