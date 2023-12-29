import selectEvent from 'react-select-event';
import {Event as EventFixture} from 'sentry-fixture/event';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {SentryApp} from 'sentry-fixture/sentryApp';
import {
  SentryAppComponent,
  SentryAppComponentAsync,
  SentryAppComponentDependent,
} from 'sentry-fixture/sentryAppComponent';
import {SentryAppInstallation} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SentryAppExternalIssueForm from 'sentry/components/group/sentryAppExternalIssueForm';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

describe('SentryAppExternalIssueForm', () => {
  const group = GroupFixture({
    title: 'ApiError: Broken',
    shortId: 'SEN123',
    permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
  });
  const component = SentryAppComponent();
  const sentryApp = SentryApp();
  const sentryAppInstallation = SentryAppInstallation({});
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
    it('can create a new issue', async () => {
      render(
        <SentryAppExternalIssueForm
          event={EventFixture()}
          onSubmitSuccess={jest.fn()}
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.create}
          action="create"
        />
      );

      // renders each required_fields field
      expect(component.schema.create.required_fields).toHaveLength(3);
      for (const field of component.schema.create.required_fields) {
        expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
      }

      // Prevents submission if required fields are not set
      await userEvent.clear(screen.getByRole('textbox', {name: 'Title'}));
      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));
      expect(externalIssueRequest).not.toHaveBeenCalled();

      selectEvent.openMenu(screen.getByRole('textbox', {name: 'Numbers'}));
      await userEvent.type(screen.getByRole('textbox', {name: 'Numbers'}), '1');
      await userEvent.click(screen.getByText('one'));

      // Sets required fields
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Title'}),
        'ApiError: Broken'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

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
            uri: '',
          },
          method: 'POST',
        })
      );
    });

    it('renders prepopulated defaults', () => {
      render(
        <SentryAppExternalIssueForm
          event={EventFixture()}
          onSubmitSuccess={jest.fn()}
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.create}
          action="create"
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
    it('can link an issue', async () => {
      render(
        <SentryAppExternalIssueForm
          event={EventFixture()}
          onSubmitSuccess={jest.fn()}
          group={group}
          sentryAppInstallation={sentryAppInstallation}
          appName={sentryApp.name}
          config={component.schema.link}
          action="link"
        />
      );

      // renders each required_fields field
      expect(component.schema.link.required_fields).toHaveLength(1);
      for (const field of component.schema.link.required_fields) {
        expect(screen.getByRole('textbox', {name: field.label})).toBeInTheDocument();
      }

      await userEvent.type(screen.getByRole('textbox', {name: 'Issue'}), 'my issue');
      await userEvent.click(screen.getByRole('button', {name: 'Save Changes'}));

      expect(externalIssueRequest).toHaveBeenCalledWith(
        submitUrl,
        expect.objectContaining({
          data: {
            action: 'link',
            groupId: '1',
            issue: 'my issue',
            uri: '',
          },
          method: 'POST',
        })
      );
    });
  });
});

describe('SentryAppExternalIssueForm Async Field', () => {
  const component = SentryAppComponentAsync();
  const group = GroupFixture({
    title: 'ApiError: Broken',
    shortId: 'SEN123',
    permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
  });
  const sentryApp = SentryApp();
  const sentryAppInstallation = SentryAppInstallation({});

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
        event={EventFixture()}
        onSubmitSuccess={jest.fn()}
        group={group}
        sentryAppInstallation={sentryAppInstallation}
        appName={sentryApp.name}
        config={component.schema.create}
        action="create"
      />
    );

    selectEvent.openMenu(screen.getByText('Numbers'));
    await userEvent.type(screen.getByRole('textbox'), 'I');

    expect(mockGetOptions).toHaveBeenCalled();
    expect(await screen.findByText('Issue 1')).toBeInTheDocument();
    expect(await screen.findByText('Issue 2')).toBeInTheDocument();
  });
});

describe('SentryAppExternalIssueForm Dependent fields', () => {
  const group = GroupFixture({
    title: 'ApiError: Broken',
    shortId: 'SEN123',
    permalink: 'https://sentry.io/organizations/sentry/issues/123/?project=1',
  });
  const sentryApp = SentryApp();
  const sentryAppInstallation = SentryAppInstallation({});
  const component = SentryAppComponentDependent();

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
        event={EventFixture()}
        onSubmitSuccess={jest.fn()}
        group={group}
        sentryAppInstallation={sentryAppInstallation}
        appName={sentryApp.name}
        config={component.schema.create}
        action="create"
      />
    );

    await userEvent.type(screen.getByRole('textbox', {name: 'Project'}), 'p');

    expect(await screen.findByText('project A')).toBeInTheDocument();
    expect(screen.getByText('project B')).toBeInTheDocument();

    // project select should be disabled and we shouldn't fetch the options yet
    expect(screen.getByRole('textbox', {name: 'Board'})).toBeDisabled();
    expect(boardMock).not.toHaveBeenCalled();

    // when we set the value for project we should get the values for the board
    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'project A');

    expect(boardMock).toHaveBeenCalled();
    expect(screen.getByRole('textbox', {name: 'Board'})).toBeEnabled();

    await userEvent.type(screen.getByRole('textbox', {name: 'Board'}), 'b');

    expect(await screen.findByText('board R')).toBeInTheDocument();
    expect(screen.getByText('board S')).toBeInTheDocument();
  });
});
