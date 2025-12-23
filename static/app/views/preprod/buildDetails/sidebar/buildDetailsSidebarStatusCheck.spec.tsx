import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BuildDetailsSidebarStatusCheck} from './buildDetailsSidebarStatusCheck';

describe('BuildDetailsSidebarStatusCheck', () => {
  const mockVcsInfo = {
    head_sha: 'abc123',
    base_sha: 'def456',
    provider: 'github',
    head_repo_name: 'owner/repo',
    base_repo_name: 'owner/repo',
    head_ref: 'feature-branch',
    base_ref: 'main',
    pr_number: 123,
  };

  it('renders nothing when statusCheck is null', () => {
    const {container} = render(
      <BuildDetailsSidebarStatusCheck statusCheck={null} vcsInfo={mockVcsInfo} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when statusCheck is undefined', () => {
    const {container} = render(
      <BuildDetailsSidebarStatusCheck statusCheck={undefined} vcsInfo={mockVcsInfo} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders success message with link when status check succeeds', () => {
    const statusCheck = {
      success: true as const,
      check_id: '12345',
    };

    render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(
      screen.getByRole('link', {name: /View status check on Github/i})
    ).toHaveAttribute('href', 'https://github.com/owner/repo/runs/12345');
  });

  it('renders nothing when status check succeeds but has no check_id', () => {
    const statusCheck = {
      success: true as const,
      check_id: null,
    };

    const {container} = render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders error message for integration error', () => {
    const statusCheck = {
      success: false as const,
      error_type: 'integration_error' as const,
    };

    render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(screen.getByText('Status check failed to post')).toBeInTheDocument();
    expect(screen.getByText(/Github integration/i)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /View CI setup docs/i})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/size-analysis/integrating-into-ci/'
    );
  });

  it('renders error message for API error', () => {
    const statusCheck = {
      success: false as const,
      error_type: 'api_error' as const,
    };

    render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(screen.getByText('Status check failed to post')).toBeInTheDocument();
    expect(screen.getByText(/temporary API error occurred/i)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /View CI setup docs/i})).toBeInTheDocument();
  });

  it('renders error message for unknown error', () => {
    const statusCheck = {
      success: false as const,
      error_type: 'unknown' as const,
    };

    render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(screen.getByText('Status check failed to post')).toBeInTheDocument();
    expect(
      screen.getByText(/error occurred while posting the status check to Github/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /View CI setup docs/i})).toBeInTheDocument();
  });

  it('renders error message when error_type is null', () => {
    const statusCheck = {
      success: false as const,
      error_type: null,
    };

    render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(screen.getByText('Status check failed to post')).toBeInTheDocument();
    expect(
      screen.getByText(/error occurred while posting the status check to Github/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /View CI setup docs/i})).toBeInTheDocument();
  });

  it('capitalizes provider name in success message', () => {
    const statusCheck = {
      success: true as const,
      check_id: '12345',
    };

    render(
      <BuildDetailsSidebarStatusCheck statusCheck={statusCheck} vcsInfo={mockVcsInfo} />
    );

    expect(screen.getByRole('link', {name: /Github/})).toBeInTheDocument();
  });

  it('renders nothing for success when provider is not set', () => {
    const statusCheck = {
      success: true as const,
      check_id: '12345',
    };

    const vcsInfoWithoutProvider = {
      ...mockVcsInfo,
      provider: null,
    };

    const {container} = render(
      <BuildDetailsSidebarStatusCheck
        statusCheck={statusCheck}
        vcsInfo={vcsInfoWithoutProvider}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for error when provider is not set', () => {
    const statusCheck = {
      success: false as const,
      error_type: 'integration_error' as const,
    };

    const vcsInfoWithoutProvider = {
      ...mockVcsInfo,
      provider: null,
    };

    const {container} = render(
      <BuildDetailsSidebarStatusCheck
        statusCheck={statusCheck}
        vcsInfo={vcsInfoWithoutProvider}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
