import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  AutofixStatus,
  AutofixStepType,
  type AutofixChangesStep,
} from 'sentry/components/events/autofix/types';

import {PRCombinedStatusCell} from './statusCells';

describe('PRCombinedStatusCell', () => {
  it('renders N/A when seerState is undefined', () => {
    render(<PRCombinedStatusCell seerState={undefined} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders N/A when seerState is null', () => {
    render(<PRCombinedStatusCell seerState={null} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders N/A when seerState has no steps', () => {
    const seerState = AutofixDataFixture({
      steps: [],
    });

    render(<PRCombinedStatusCell seerState={seerState} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders N/A when changes step has no changes', () => {
    const seerState = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          type: AutofixStepType.CHANGES,
          key: 'changes',
          status: AutofixStatus.COMPLETED,
          changes: [],
        }) as AutofixChangesStep,
      ],
    });

    render(<PRCombinedStatusCell seerState={seerState} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders N/A when pull_request has no pr_url', () => {
    const seerState = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          type: AutofixStepType.CHANGES,
          key: 'changes',
          status: AutofixStatus.COMPLETED,
          changes: [
            AutofixCodebaseChangeData({
              pull_request: {
                pr_number: 123,
                pr_url: '',
              },
            }),
          ],
        }) as AutofixChangesStep,
      ],
    });

    render(<PRCombinedStatusCell seerState={seerState} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders PR link with number when pr_url and pr_number exist', () => {
    const seerState = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          type: AutofixStepType.CHANGES,
          key: 'changes',
          status: AutofixStatus.COMPLETED,
          changes: [
            AutofixCodebaseChangeData({
              pull_request: {
                pr_number: 123,
                pr_url: 'https://github.com/owner/repo/pull/123',
              },
            }),
          ],
        }) as AutofixChangesStep,
      ],
    });

    render(<PRCombinedStatusCell seerState={seerState} />);

    const link = screen.getByRole('link', {name: 'PR #123'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/pull/123');
  });

  it('renders generic PR link when pr_url exists but pr_number is missing', () => {
    const seerState = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          type: AutofixStepType.CHANGES,
          key: 'changes',
          status: AutofixStatus.COMPLETED,
          changes: [
            AutofixCodebaseChangeData({
              pull_request: {
                pr_number: 0,
                pr_url: 'https://github.com/owner/repo/pull/123',
              },
            }),
          ],
        }) as AutofixChangesStep,
      ],
    });

    render(<PRCombinedStatusCell seerState={seerState} />);

    const link = screen.getByRole('link', {name: 'View PR'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/owner/repo/pull/123');
  });
});
