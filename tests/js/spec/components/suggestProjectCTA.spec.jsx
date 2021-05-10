import {mountWithTheme} from 'sentry-test/enzyme';

import {openModal} from 'app/actionCreators/modal';
import SuggestProjectCTA from 'app/components/suggestProjectCTA';
import ProjectsStore from 'app/stores/projectsStore';

jest.mock('app/actionCreators/modal');

function generateWrapperAndSetMocks(inputProps, mobileEventResp, promptResp) {
  const projects = inputProps?.projects ?? [TestStubs.Project({platform: 'javascript'})];

  jest.spyOn(ProjectsStore, 'getState').mockImplementation(() => ({
    projects,
    loading: false,
  }));

  const organization = TestStubs.Organization();

  MockApiClient.addMockResponse({
    url: `/prompts-activity/`,
    body: promptResp || {},
  });
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/has-mobile-app-events/`,
    body: mobileEventResp,
  });

  const props = {
    organization,
    event: TestStubs.Event({
      entries: [{type: 'request', data: {headers: [['User-Agent', 'okhttp/123']]}}],
    }),
    ...inputProps,
  };
  return mountWithTheme(<SuggestProjectCTA {...props} />);
}

describe('SuggestProjectCTA', function () {
  it('user agent match and and open modal', async () => {
    const wrapper = generateWrapperAndSetMocks();
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(1);
    wrapper.find('a').simulate('click');
    expect(openModal).toHaveBeenCalled();
  });

  it('mobile event match', async () => {
    const wrapper = generateWrapperAndSetMocks(
      {
        event: TestStubs.Event({
          entries: [{type: 'request', data: {headers: [['User-Agent', 'sentry/123']]}}],
        }),
      },
      {browserName: 'okhttp'}
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(1);
  });

  it('user agent does not match', async () => {
    const wrapper = generateWrapperAndSetMocks({
      event: TestStubs.Event({
        entries: [{type: 'request', data: {headers: [['User-Agent', 'sentry/123']]}}],
      }),
    });
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(0);
  });
  it('has mobile project', async () => {
    const projects = [TestStubs.Project({platform: 'android'})];
    const wrapper = generateWrapperAndSetMocks({
      projects,
    });
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(0);
  });
  it('prompt is dismissed', async () => {
    const wrapper = generateWrapperAndSetMocks(undefined, undefined, {
      data: {dismissed_ts: 1234},
    });
    await tick();
    wrapper.update();
    expect(wrapper.find('Alert')).toHaveLength(0);
  });
});
