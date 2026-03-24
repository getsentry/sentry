import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {mockTour} from 'sentry/components/tours/testUtils';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';

const mockFeedbackForm = jest.fn();
jest.mock('sentry/utils/useFeedbackForm', () => ({
  useFeedbackForm: () => mockFeedbackForm(),
}));

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

describe('NewIssueExperienceButton', () => {
  const organization = OrganizationFixture({streamlineOnly: null});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is hidden when no streamlined actions are available', () => {
    const {unmount: unmountOptionTrue} = render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {
        organization: {
          ...organization,
          streamlineOnly: true,
        },
      }
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
    unmountOptionTrue();

    const {unmount: unmountOptionFalse} = render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {
        organization: {
          ...organization,
          streamlineOnly: false,
        },
      }
    );
    expect(screen.getByTestId('test-id')).toBeEmptyDOMElement();
    unmountOptionFalse();
  });

  it('appears when feedback action is available', () => {
    mockFeedbackForm.mockReturnValue(jest.fn());
    render(
      <div data-test-id="test-id">
        <NewIssueExperienceButton />
      </div>,
      {organization}
    );
    expect(screen.getByTestId('test-id')).not.toBeEmptyDOMElement();
  });
});
