import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueSyncListElement from 'sentry/components/issueSyncListElement';

describe('IssueSyncListElement', function () {
  it('renders', function () {
    const wrapper = render(<IssueSyncListElement integrationType="github" />);
    expect(wrapper.container).toSnapshot();
  });

  it('can open', function () {
    const onOpen = jest.fn();
    render(<IssueSyncListElement integrationType="github" onOpen={onOpen} />);
    expect(onOpen).not.toHaveBeenCalled();
    userEvent.click(screen.getByText('GitHub Issue'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('can close', function () {
    const onClose = jest.fn();
    const onOpen = jest.fn();

    render(
      <IssueSyncListElement
        integrationType="github"
        externalIssueLink="github.com/issues/gh-101"
        externalIssueId={101}
        onClose={onClose}
        onOpen={onOpen}
      />
    );

    expect(onClose).not.toHaveBeenCalled();
    userEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onClose).toHaveBeenCalled();
  });
});
