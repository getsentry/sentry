import {Fragment} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {clearIndicators} from 'sentry/actionCreators/indicator';
import {useDeleteFeedback} from 'sentry/components/feedback/useDeleteFeedback';
import Indicators from 'sentry/components/indicators';

const mockRefetchFeedbackList = jest.fn();

jest.mock('sentry/components/feedback/list/useRefetchFeedbackList', () => ({
  useRefetchFeedbackList: () => ({refetchFeedbackList: mockRefetchFeedbackList}),
}));

const organization = OrganizationFixture();
const initialPath = `/organizations/${organization.slug}/issues/feedback/123/`;

function DeleteFeedbackButton() {
  const deleteFeedback = useDeleteFeedback(['123'], 'project');

  return <button onClick={deleteFeedback}>Delete feedback</button>;
}

function renderDeleteFeedback() {
  return render(
    <Fragment>
      <GlobalModal />
      <DeleteFeedbackButton />
      <Indicators />
    </Fragment>,
    {
      organization,
      initialRouterConfig: {
        location: {pathname: initialPath},
        route: '/organizations/:orgId/issues/feedback/:feedbackId/',
      },
    }
  );
}

async function confirmDelete() {
  await userEvent.click(screen.getByRole('button', {name: 'Delete feedback'}));
  await userEvent.click(
    within(await screen.findByRole('dialog')).getByRole('button', {name: 'Delete'})
  );
}

describe('useDeleteFeedback', () => {
  beforeEach(() => {
    clearIndicators();
    mockRefetchFeedbackList.mockClear();
  });

  it('navigates after deleting feedback successfully', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'DELETE',
      body: {},
    });
    const {router} = renderDeleteFeedback();

    await confirmDelete();

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/issues/feedback/`
      );
    });
    expect(mockRefetchFeedbackList).toHaveBeenCalledTimes(1);
  });

  it('refetches without navigating when deleting feedback fails', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'DELETE',
      statusCode: 500,
    });
    const {router} = renderDeleteFeedback();

    await confirmDelete();

    expect(
      await screen.findByText('Unable to delete events. Please try again.')
    ).toBeInTheDocument();
    expect(mockRefetchFeedbackList).toHaveBeenCalledTimes(1);
    expect(router.location.pathname).toBe(initialPath);
  });
});
