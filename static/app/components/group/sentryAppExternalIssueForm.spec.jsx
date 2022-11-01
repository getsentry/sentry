import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import SentryAppExternalIssueForm from 'sentry/components/group/sentryAppExternalIssueForm';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

describe('SentryAppExternalIssueForm', () => {
  const group = TestStubs.Group({
    title: 'ApiError: Broken',
    shortId: 'SEN123',
    permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
  });
  const component = TestStubs.SentryAppComponent();
  const sentryApp = TestStubs.SentryApp();
  const sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
  const submitUrl = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-issue-actions/`;
  let externalIssueRequest;

  beforeEach(() => {
    externalIssueRequest = MockApiClient.addMockResponse({
      url: submitUrl,
      method: 'POST',
      body: {},
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('create', () => {
    it('can create a new issue', () => {
      render(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.create}
          action="create"
          api={new Client()}
        />
      );

      // renders each required_fields field
      expect(component.schema.create.required_fields).toHaveLength(3);
      for (const field of component.schema.create.required_fields) {
        expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
      }

      // Prevents submission if required fields are not set
      userEvent.clear(screen.getByRole('textbox', {name: 'Title'}));
      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));
      expect(externalIssueRequest).not.toHaveBeenCalled();

      selectEvent.openMenu(screen.getByRole('textbox', {name: 'Numbers'}));
      userEvent.type(screen.getByRole('textbox', {name: 'Numbers'}), '1');
      userEvent.click(screen.getByText('one'));

      // Sets required fields
      userEvent.type(screen.getByRole('textbox', {name: 'Title'}), 'ApiError: Broken');
      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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
      render(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.create}
          action="create"
          api={new Client()}
        />
      );
      expect(screen.getByRole('textbox', {name: 'Title'})).toHaveValue(`${group.title}`);

      const url = addQueryParamsToExistingUrl(group.permalink, {
        referrer: sentryApp.name,
      });
      expect(screen.getByRole('textbox', {name: 'Description'})).toHaveValue(
        `Sentry Issue: [${group.shortId}](${url})`
      );
    });
  });

  describe('link', () => {
    it('can link an issue', () => {
      render(
        <SentryAppExternalIssueForm
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.link}
          action="link"
          api={new Client()}
        />
      );

      // renders each required_fields field
      expect(component.schema.link.required_fields).toHaveLength(1);
      for (const field of component.schema.link.required_fields) {
        expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
      }

      userEvent.type(screen.getByRole('textbox', {name: 'Issue'}), 'my issue');
      userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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
  const component = TestStubs.SentryAppComponentAsync();
  const group = TestStubs.Group({
    title: 'ApiError: Broken',
    shortId: 'SEN123',
    permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
  });
  const sentryApp = TestStubs.SentryApp();
  const sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders each required_fields field', async function () {
    const mockGetOptions = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/sentry-app-installations/d950595e-cba2-46f6-8a94-b79e42806f98/external-requests/',
      body: {
        choices: [
          [1, 'Issue 1'],
          [2, 'Issue 2'],
        ],
      },
    });

    render(
      <SentryAppExternalIssueForm
        group={group}
        sentryAppInstallation={sentryAppInstallation}
        appName={sentryApp.name}
        config={component.schema.create}
        action="create"
        api={new Client()}
      />
    );

    selectEvent.openMenu(screen.getByText('Numbers'));
    userEvent.type(screen.getByRole('textbox'), 'I');

    expect(mockGetOptions).toHaveBeenCalled();
    expect(await screen.findByText('Issue 1')).toBeInTheDocument();
    expect(await screen.findByText('Issue 2')).toBeInTheDocument();
  });
});

describe('SentryAppExternalIssueForm Dependent fields', () => {
  const group = TestStubs.Group({
    title: 'ApiError: Broken',
    shortId: 'SEN123',
    permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
  });
  const sentryApp = TestStubs.SentryApp();
  const sentryAppInstallation = TestStubs.SentryAppInstallation({sentryApp});
  const component = TestStubs.SentryAppComponentDependent();

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('load options for field that has dependencies when the dependent option is selected', async () => {
    const url = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`;
    MockApiClient.addMockResponse({
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

    const boardMock = MockApiClient.addMockResponse({
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

    render(
      <SentryAppExternalIssueForm
        group={group}
        sentryAppInstallation={sentryAppInstallation}
        appName={sentryApp.name}
        config={component.schema.create}
        action="create"
        api={new Client()}
      />
    );

    userEvent.type(screen.getByRole('textbox', {name: 'Project'}), 'p');

    expect(await screen.findByText('project A')).toBeInTheDocument();
    expect(screen.getByText('project B')).toBeInTheDocument();

    // project select should be disabled and we shouldn't fetch the options yet
    expect(screen.getByRole('textbox', {name: 'Board'})).toBeDisabled();
    expect(boardMock).not.toHaveBeenCalled();

    // when we set the value for project we should get the values for the board
    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'project A');

    expect(boardMock).toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: 'Board'})).toBeEnabled();

    userEvent.type(screen.getByRole('textbox', {name: 'Board'}), 'b');

    expect(await screen.findByText('board R')).toBeInTheDocument();
    expect(screen.getByText('board S')).toBeInTheDocument();
  });
});
