import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutofixSolution} from 'sentry/components/events/autofix/autofixSolution';

describe('AutofixSolution', () => {
  const defaultSolution = [
    {
      title: 'Fix the bug',
      code_snippet_and_analysis: 'Some code and analysis',
      timeline_item_type: 'internal_code' as const,
      relevant_code_file: {
        file_path: 'src/file.js',
        repo_name: 'owner/repo',
      },
    },
  ];

  const defaultProps = {
    solution: defaultSolution,
    groupId: '123',
    runId: 'run-123',
    repos: [],
    solutionSelected: false,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });
  });

  it('enables Code It Up button when all repos are readable', () => {
    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo1',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo1',
            is_readable: true,
          },
          {
            name: 'owner/repo2',
            default_branch: 'main',
            external_id: 'repo2',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo2',
            is_readable: true,
          },
        ]}
      />
    );

    const codeItUpButton = screen.getByText('Code It Up');
    expect(codeItUpButton).toBeEnabled();
  });

  it('disables Code It Up button when all repos are not readable', () => {
    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo1',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo1',
            is_readable: false,
          },
          {
            name: 'owner/repo2',
            default_branch: 'main',
            external_id: 'repo2',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo2',
            is_readable: false,
          },
        ]}
      />
    );

    const codeItUpButton = screen.getByRole('button', {name: 'Code It Up'});
    expect(codeItUpButton).toBeDisabled();
  });

  it('enables Code It Up button when at least one repo is readable', () => {
    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo1',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo1',
            is_readable: true,
          },
          {
            name: 'owner/repo2',
            default_branch: 'main',
            external_id: 'repo2',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo2',
            is_readable: false,
          },
        ]}
      />
    );

    const codeItUpButton = screen.getByText('Code It Up');
    expect(codeItUpButton).toBeEnabled();
  });

  it('treats repos with is_readable=null as readable', () => {
    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo1',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo1',
            is_readable: undefined,
          },
          {
            name: 'owner/repo2',
            default_branch: 'main',
            external_id: 'repo2',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo2',
            is_readable: false,
          },
        ]}
      />
    );

    const codeItUpButton = screen.getByText('Code It Up');
    expect(codeItUpButton).toBeEnabled();
  });

  it('treats repos with is_readable=undefined as readable', () => {
    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo1',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo1',
            // is_readable is intentionally undefined
          },
          {
            name: 'owner/repo2',
            default_branch: 'main',
            external_id: 'repo2',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo2',
            is_readable: false,
          },
        ]}
      />
    );

    const codeItUpButton = screen.getByText('Code It Up');
    expect(codeItUpButton).toBeEnabled();
  });

  it('treats empty repos array as having no repository constraints', () => {
    render(<AutofixSolution {...defaultProps} repos={[]} />);

    const codeItUpButton = screen.getByText('Code It Up');
    expect(codeItUpButton).toBeEnabled();
  });
});
