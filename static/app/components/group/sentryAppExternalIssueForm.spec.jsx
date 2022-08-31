import {mountWithTheme} from 'sentry-test/enzyme';
import {changeInputValue, selectByValue} from 'sentry-test/select-new';

import {Client} from 'sentry/api';
import SentryAppExternalIssueForm from 'sentry/components/group/sentryAppExternalIssueForm';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

const optionLabelSelector = label => `[label="${label}"]`;

describe('SentryAppExternalIssueForm', () => {
  let wrapper;
  let group;
  let sentryApp;
  let sentryAppInstallation;
  let component;
  let submitUrl;
  let externalIssueRequest;

  beforeEach(() => {
    group = TestStubs.Group({
      title: 'ApiError: Broken',
      shortId: 'SEN123',
      permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
    });
    component = TestStubs.SentryAppComponent();
    sentryApp = TestStubs.SentryApp();
    sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
    submitUrl = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-issue-actions/`;
    externalIssueRequest = Client.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: {},
    });
  });

  describe('create', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.create}
          action="create"
          api={new Client()}
        />
      );
    });

    it('renders each required_fields field', () => {
      component.schema.create.required_fields.forEach(field => {
        expect(wrapper.exists(`#${field.name}`)).toBe(true);
      });
    });

    it('does not submit form if required fields are not set', () => {
      wrapper.find('form').simulate('submit');
      expect(externalIssueRequest).not.toHaveBeenCalled();
    });

    it('submits to the New External Issue endpoint', () => {
      selectByValue(wrapper, 'number_1', {name: 'numbers', control: true});

      wrapper.find('form').simulate('submit');

      expect(externalIssueRequest).toHaveBeenCalledWith(
        submitUrl,
        expect.objectContaining({
          data: {
            action: 'create',
            description:
              'Sentry Issue: [SEN123](https://sentry.io/organizations/sentry/issues/123/?project=1&referrer=Sample%20App)',
            groupId: '1',
            numbers: 'number_1',
            title: 'ApiError: Broken',
          },
          method: 'POST',
        })
      );
    });

    it('renders prepopulated defaults', () => {
      const titleField = wrapper.find('Input#title');
      const descriptionField = wrapper.find('TextArea#description');

      const url = addQueryParamsToExistingUrl(group.permalink, {
        referrer: sentryApp.name,
      });

      expect(titleField.prop('value')).toEqual(`${group.title}`);

      expect(descriptionField.prop('value')).toEqual(
        `Sentry Issue: [${group.shortId}](${url})`
      );
    });
  });

  describe('link', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.link}
          action="link"
          api={new Client()}
        />
      );
    });

    it('renders each required_fields field', () => {
      component.schema.link.required_fields.forEach(field => {
        expect(wrapper.exists(`#${field.name}`)).toBe(true);
      });
    });

    it('submits to the New External Issue endpoint', () => {
      wrapper
        .find('input[name="issue"]')
        .simulate('change', {target: {value: 'my issue'}});

      wrapper.find('form').simulate('submit');

      expect(externalIssueRequest).toHaveBeenCalledWith(
        submitUrl,
        expect.objectContaining({
          data: {
            action: 'link',
            groupId: '1',
            issue: 'my issue',
          },
          method: 'POST',
        })
      );
    });
  });
});

describe('SentryAppExternalIssueForm Async Field', () => {
  let wrapper;
  let group;
  let sentryApp;
  let sentryAppInstallation;
  const component = TestStubs.SentryAppComponentAsync();

  beforeEach(() => {
    group = TestStubs.Group({
      title: 'ApiError: Broken',
      shortId: 'SEN123',
      permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
    });
    sentryApp = TestStubs.SentryApp();
    sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
  });

  afterEach(() => {
    Client.clearMockResponses();
  });

  describe('renders', () => {
    it('renders each required_fields field', async function () {
      const mockGetOptions = Client.addMockResponse({
        method: 'GET',
        url: '/sentry-app-installations/d950595e-cba2-46f6-8a94-b79e42806f98/external-requests/',
        body: {
          choices: [
            [1, 'Issue 1'],
            [2, 'Issue 2'],
          ],
        },
      });

      wrapper = mountWithTheme(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.create}
          action="create"
          api={new Client()}
        />
      );

      const thisInput = wrapper.find('input').at(0);
      changeInputValue(thisInput, 'I');

      await tick();
      wrapper.update();
      expect(mockGetOptions).toHaveBeenCalled();
      expect(wrapper.find(optionLabelSelector('Issue 1')).exists()).toBe(true);
      expect(wrapper.find(optionLabelSelector('Issue 2')).exists()).toBe(true);
    });
  });
});

describe('SentryAppExternalIssueForm Dependent fields', () => {
  let wrapper;
  let group;
  let sentryApp;
  let sentryAppInstallation;
  const component = TestStubs.SentryAppComponentDependent();

  beforeEach(() => {
    group = TestStubs.Group({
      title: 'ApiError: Broken',
      shortId: 'SEN123',
      permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
    });
    sentryApp = TestStubs.SentryApp();
    sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});

    wrapper = mountWithTheme(
      <SentryAppExternalIssueForm
        group={group}
        sentryAppInstallation={sentryAppInstallation}
        appName={sentryApp.name}
        config={component.schema.create}
        action="create"
        api={new Client()}
      />
    );
  });

  afterEach(() => {
    Client.clearMockResponses();
  });

  describe('create', () => {
    it('load options for field that has dependencies when the dependent option is selected', async () => {
      const url = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`;
      Client.addMockResponse({
        method: 'GET',
        url,
        body: {
          choices: [
            ['A', 'project A'],
            ['B', 'project B'],
          ],
        },
        match: [MockApiClient.matchQuery({uri: '/integrations/sentry/projects'})],
      });

      const boardMock = Client.addMockResponse({
        method: 'GET',
        url,
        body: {
          choices: [
            ['R', 'board R'],
            ['S', 'board S'],
          ],
        },
        match: [
          MockApiClient.matchQuery({
            uri: '/integrations/sentry/boards',
            dependentData: JSON.stringify({project_id: 'A'}),
          }),
        ],
      });

      const projectInput = wrapper.find('[data-test-id="project_id"] input').at(0);
      changeInputValue(projectInput, 'p');
      await tick();
      wrapper.update();

      expect(wrapper.find(optionLabelSelector('project A')).exists()).toBe(true);
      expect(wrapper.find(optionLabelSelector('project B')).exists()).toBe(true);

      // project select should be disabled and we shouldn't fetch the options yet
      expect(wrapper.find('SelectControl#board_id').prop('disabled')).toBe(true);
      expect(boardMock).not.toHaveBeenCalled();

      // when we set the value for project we should get the values for the board
      selectByValue(wrapper, 'A', {name: 'project_id'});
      await tick();
      wrapper.update();

      expect(boardMock).toHaveBeenCalled();
      expect(wrapper.find('SelectControl#board_id').prop('disabled')).toBe(false);

      const boardInput = wrapper.find('[data-test-id="board_id"] input').at(0);
      changeInputValue(boardInput, 'b');

      await tick();
      wrapper.update();

      expect(wrapper.find(optionLabelSelector('board R')).exists()).toBe(true);
      expect(wrapper.find(optionLabelSelector('board S')).exists()).toBe(true);
    });
  });
});
