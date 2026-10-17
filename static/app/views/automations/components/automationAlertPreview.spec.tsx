import {useState} from 'react';
import {ActionFilterFixture, DataConditionFixture} from 'sentry-fixture/automations';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Form} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';
import {
  DataConditionGroupLogicType,
  DataConditionType,
} from 'sentry/types/workflowEngine/dataConditions';
import {AutomationAlertPreview} from 'sentry/views/automations/components/automationAlertPreview';
import {AutomationBuilderTestProvider} from 'sentry/views/automations/components/testUtils';

jest.unmock('@tanstack/react-pacer');

const organization = OrganizationFixture();
const previewUrl = `/organizations/${organization.slug}/workflows/preview/`;
const groupsUrl = `/organizations/${organization.slug}/issues/`;
const trigger = DataConditionFixture({
  id: 'trigger-condition',
  type: DataConditionType.FIRST_SEEN_EVENT,
  comparison: true,
});
const actionFilter = ActionFilterFixture({id: 'action-filter', conditions: []});

function PreviewTest({
  detectorIds = [],
  model: providedModel,
  projectIds = ['1'],
  triggerType = DataConditionType.FIRST_SEEN_EVENT,
}: {
  detectorIds?: string[];
  model?: FormModel;
  projectIds?: string[];
  triggerType?: DataConditionType;
}) {
  const [model] = useState(() => {
    const formModel = new FormModel();
    formModel.setInitialData({
      allProjects: false,
      detectorIds,
      environment: null,
      frequency: 30,
      projectIds,
    });
    return formModel;
  });

  return (
    <AutomationBuilderTestProvider
      builderState={{
        triggers: {
          id: 'triggers',
          logicType: DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
          conditions: [{...trigger, type: triggerType}],
        },
        actionFilters: [actionFilter],
      }}
    >
      <Form model={providedModel ?? model} hideFooter>
        <AutomationAlertPreview />
      </Form>
    </AutomationBuilderTestProvider>
  );
}

describe('AutomationAlertPreview', () => {
  describe('debounced configuration changes', () => {
    afterEach(async () => {
      try {
        cleanup();
        await act(async () => {
          await jest.runOnlyPendingTimersAsync();
        });
      } finally {
        jest.useRealTimers();
      }
    });
    it('does not refetch when a configuration change is reverted before debounce settles', async () => {
      jest.useFakeTimers();

      const model = new FormModel();
      model.setInitialData({projectIds: ['1'], frequency: 30});
      const previewRequest = MockApiClient.addMockResponse({
        url: previewUrl,
        method: 'POST',
        body: [{results: []}],
      });
      render(<PreviewTest model={model} />, {organization});
      expect(await screen.findByText('No matching alerts found')).toBeInTheDocument();

      act(() => model.setValue('frequency', 60));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(200);
      });
      act(() => model.setValue('frequency', 30));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(600);
      });

      expect(screen.getByText('No matching alerts found')).toBeInTheDocument();
      expect(previewRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('does not replace the current preview with a late response', async () => {
    const olderResponse = Promise.withResolvers<void>();
    const currentResponse = Promise.withResolvers<void>();
    const model = new FormModel();
    model.setInitialData({projectIds: ['1'], frequency: null});
    const group = GroupFixture({id: '123', title: 'Current preview issue'});
    const olderRequest = MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      match: [MockApiClient.matchData({config: {frequency: 0}})],
      body: [{results: []}],
      asyncDelay: olderResponse.promise,
    });
    const currentRequest = MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      match: [MockApiClient.matchData({config: {frequency: 60}})],
      body: [
        {
          results: [
            {groupId: group.id, triggeredAt: '2026-09-24T12:00:00Z', isThrottled: false},
          ],
        },
      ],
      asyncDelay: currentResponse.promise,
    });
    MockApiClient.addMockResponse({url: groupsUrl, body: [group]});

    render(<PreviewTest model={model} />, {organization});
    await waitFor(() => expect(olderRequest).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('No matching alerts found')).not.toBeInTheDocument();

    act(() => model.setValue('frequency', 60));
    await waitFor(() => expect(currentRequest).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('No matching alerts found')).not.toBeInTheDocument();
    currentResponse.resolve();
    expect(await screen.findByText('Current preview issue')).toBeInTheDocument();

    await act(async () => {
      olderResponse.resolve();
      await olderResponse.promise;
    });

    expect(screen.getByText('Current preview issue')).toBeInTheDocument();
    expect(screen.queryByText('No matching alerts found')).not.toBeInTheDocument();
  });

  it('hides previous results while loading a changed configuration', async () => {
    const group = GroupFixture({id: '123', title: 'Previous preview issue'});
    const model = new FormModel();
    model.setInitialData({projectIds: ['1'], frequency: 30});
    MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      body: [
        {
          results: [
            {groupId: group.id, triggeredAt: '2026-09-24T12:00:00Z', isThrottled: false},
          ],
        },
      ],
    });
    MockApiClient.addMockResponse({url: groupsUrl, body: [group]});
    render(<PreviewTest model={model} />, {organization});
    expect(await screen.findByText('Previous preview issue')).toBeInTheDocument();

    const response = Promise.withResolvers<void>();
    const request = MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      body: [{results: []}],
      asyncDelay: response.promise,
    });
    act(() => model.setValue('frequency', 60));
    expect(screen.queryByText('Previous preview issue')).not.toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Previous preview issue')).not.toBeInTheDocument();
    expect(screen.queryByText('No matching alerts found')).not.toBeInTheDocument();

    response.resolve();
    expect(await screen.findByText('No matching alerts found')).toBeInTheDocument();
  });

  it('waits for incomplete trigger settings before requesting a preview', async () => {
    const previewRequest = MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      body: [{results: []}],
    });
    const {rerender} = render(
      <PreviewTest triggerType={DataConditionType.SEER_ACTIVITY_TRIGGER} />,
      {organization}
    );

    expect(
      screen.getByText('Complete the alert conditions to see a preview.')
    ).toBeInTheDocument();
    expect(previewRequest).not.toHaveBeenCalled();

    rerender(<PreviewTest />);
    expect(await screen.findByText('No matching alerts found')).toBeInTheDocument();
    expect(previewRequest).toHaveBeenCalledTimes(1);
  });

  describe('removed project fields', () => {
    afterEach(async () => {
      try {
        cleanup();
        await act(async () => {
          await jest.runOnlyPendingTimersAsync();
        });
      } finally {
        jest.useRealTimers();
      }
    });
    it('regenerates the preview after the project field is removed and recreated', async () => {
      jest.useFakeTimers();

      const model = new FormModel();
      model.setInitialData({projectIds: ['1'], frequency: 30, environment: null});
      const group = GroupFixture({id: '123', title: 'Preview issue'});
      const previewRequest = MockApiClient.addMockResponse({
        url: previewUrl,
        method: 'POST',
        body: [
          {
            results: [
              {
                groupId: group.id,
                triggeredAt: '2026-09-24T12:00:00Z',
                isThrottled: false,
              },
            ],
          },
        ],
      });
      MockApiClient.addMockResponse({url: groupsUrl, body: [group]});
      render(<PreviewTest model={model} />, {organization});
      expect(await screen.findByText('Preview issue')).toBeInTheDocument();

      act(() => {
        model.removeField('projectIds');
      });
      expect(
        screen.getByText('Select at least one project to preview this alert.')
      ).toBeInTheDocument();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(600);
      });
      act(() => {
        model.setValue('projectIds', ['1']);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(600);
      });

      expect(await screen.findByText('Preview issue')).toBeInTheDocument();
      await waitFor(() => expect(previewRequest).toHaveBeenCalledTimes(2));
    });
  });

  it('paginates issues locally and resets when the alert changes', async () => {
    const groups = Array.from({length: 11}, (_, index) =>
      GroupFixture({
        id: String(index + 1),
        title: `Preview issue ${index + 1}`,
      })
    );
    const results = groups.map(group => ({
      groupId: group.id,
      triggeredAt: '2026-09-24T12:00:00Z',
      isThrottled: false,
    }));
    const previewRequest = MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      body: [{results}],
    });
    MockApiClient.addMockResponse({
      url: groupsUrl,
      match: [
        MockApiClient.matchQuery({
          group: groups.slice(0, 10).map(group => group.id),
          project: [1],
        }),
      ],
      body: groups.slice(0, 10),
    });
    MockApiClient.addMockResponse({
      url: groupsUrl,
      match: [MockApiClient.matchQuery({group: ['11'], project: [1]})],
      body: groups.slice(10),
    });

    const {rerender} = render(<PreviewTest />, {organization});

    expect(await screen.findByText('Preview issue 1')).toBeInTheDocument();
    expect(screen.getByText('Preview issue 10')).toBeInTheDocument();
    expect(screen.queryByText('Preview issue 11')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(previewRequest).toHaveBeenCalledWith(
      previewUrl,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({projectIds: [1], config: {frequency: 30}}),
      })
    );

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(await screen.findByText('Preview issue 11')).toBeInTheDocument();
    expect(screen.queryByText('Preview issue 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    expect(previewRequest).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: 'Previous'}));
    expect(await screen.findByText('Preview issue 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(await screen.findByText('Preview issue 11')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      body: [{results: results.slice(0, 1)}],
    });
    MockApiClient.addMockResponse({
      url: groupsUrl,
      match: [MockApiClient.matchQuery({group: ['1'], project: [1]})],
      body: [groups[0]],
    });
    rerender(<PreviewTest triggerType={DataConditionType.REGRESSION_EVENT} />);

    expect(await screen.findByText('Preview issue 1')).toBeInTheDocument();
    expect(screen.queryByText('Preview issue 11')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('does not request a project-wide preview for specific monitors', () => {
    const previewRequest = MockApiClient.addMockResponse({
      url: previewUrl,
      method: 'POST',
      body: [],
    });

    render(<PreviewTest detectorIds={['42']} projectIds={[]} />, {organization});

    expect(
      screen.getByText('Previews for alerts connected to monitors are not supported.')
    ).toBeInTheDocument();
    expect(previewRequest).not.toHaveBeenCalled();
  });
});
