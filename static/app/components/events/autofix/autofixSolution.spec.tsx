import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {AutofixSolution} from 'sentry/components/events/autofix/autofixSolution';
import type {AutofixSolutionTimelineEvent} from 'sentry/components/events/autofix/types';

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

  it('renders the solution timeline', () => {
    render(<AutofixSolution {...defaultProps} />);

    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
    expect(screen.getByText('Some code and analysis')).toBeInTheDocument();
  });

  it('passes the solution array when Code It Up button is clicked', async () => {
    // Mock the API directly before the test
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });

    // Use readable repos to enable the button
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
        ]}
      />
    );

    // Click the Code It Up button
    await userEvent.click(screen.getByRole('button', {name: 'Code It Up'}));

    // Wait for API call
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalled();
    });

    // Verify payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/123/autofix/update/',
      expect.objectContaining({
        data: {
          run_id: 'run-123',
          payload: {
            type: 'select_solution',
            mode: 'fix',
            solution: expect.arrayContaining([
              expect.objectContaining({
                title: 'Fix the bug',
                is_active: true, // should default to true
              }),
            ]),
          },
        },
      })
    );
  });

  it('allows toggling solution items active/inactive', async () => {
    // Mock the API directly before the test
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });

    // Use readable repos to enable the button
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
        ]}
      />
    );

    // Find the timeline item
    const timelineItem = screen.getByTestId('autofix-solution-timeline-item-0');
    expect(timelineItem).toBeInTheDocument();

    // Hover over the timeline item to reveal buttons
    await userEvent.hover(timelineItem);

    // Find and click the toggle button for deselecting the item
    const toggleButton = within(timelineItem).getByRole('button', {
      name: 'Deselect item',
    });
    expect(toggleButton).toBeInTheDocument();
    await userEvent.click(toggleButton);

    // Click the Code It Up button
    await userEvent.click(screen.getByRole('button', {name: 'Code It Up'}));

    // Wait for API call
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalled();
    });

    // Verify payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/123/autofix/update/',
      expect.objectContaining({
        data: {
          run_id: 'run-123',
          payload: {
            type: 'select_solution',
            mode: 'fix',
            solution: expect.arrayContaining([
              expect.objectContaining({
                title: 'Fix the bug',
                is_active: false,
              }),
            ]),
          },
        },
      })
    );
  });

  it('allows adding custom instructions', async () => {
    // Mock the API directly before the test
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });

    // Use readable repos to enable the button
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
        ]}
      />
    );

    // Find and fill the input
    const input = screen.getByPlaceholderText(
      'Add additional instructions for Autofix...'
    );
    await userEvent.type(input, 'This is a custom instruction');

    // Enable the Add button by typing non-empty text
    const addButton = screen.getByRole('button', {name: 'Add to solution'});
    expect(addButton).toBeEnabled();

    // Click Add button
    await userEvent.click(addButton);

    // Verify the custom instruction was added
    expect(screen.getByText('This is a custom instruction')).toBeInTheDocument();

    // Click Code It Up
    await userEvent.click(screen.getByRole('button', {name: 'Code It Up'}));

    // Wait for API call
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalled();
    });

    // Verify payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/123/autofix/update/',
      expect.objectContaining({
        data: {
          run_id: 'run-123',
          payload: {
            type: 'select_solution',
            mode: 'fix',
            solution: expect.arrayContaining([
              expect.objectContaining({
                title: 'Fix the bug',
              }),
              expect.objectContaining({
                title: 'This is a custom instruction',
                timeline_item_type: 'human_instruction',
                is_active: true,
              }),
            ]),
          },
        },
      })
    );
  });

  it('allows adding custom instructions with Enter key', async () => {
    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo',
            is_readable: true,
          },
        ]}
      />
    );

    // Find and fill the input, then press Enter
    const input = screen.getByPlaceholderText(
      'Add additional instructions for Autofix...'
    );
    await userEvent.type(input, 'Enter key instruction{Enter}');

    // Verify the custom instruction was added
    expect(screen.getByText('Enter key instruction')).toBeInTheDocument();

    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('can delete human instructions from solution', async () => {
    const solutionWithHumanInstruction = [
      ...defaultSolution,
      {
        title: 'Human instruction',
        timeline_item_type: 'human_instruction' as const,
        is_active: true,
      },
    ];

    render(
      <AutofixSolution
        {...defaultProps}
        solution={solutionWithHumanInstruction}
        repos={[
          {
            name: 'owner/repo',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo',
            is_readable: true,
          },
        ]}
      />
    );

    // Find the human instruction item
    const humanInstructionElement = screen.getByText('Human instruction');
    expect(humanInstructionElement).toBeInTheDocument();

    // Find the timeline item containing the human instruction
    const timelineItem = humanInstructionElement.closest(
      '[data-test-id^="autofix-solution-timeline-item-"]'
    ) as HTMLElement;
    expect(timelineItem).not.toBeNull();

    // Hover over the timeline item
    await userEvent.hover(timelineItem);

    // Find the delete button - there should be only one button within the hovered item
    const deleteButton = within(timelineItem).getByRole('button');
    expect(deleteButton).toBeInTheDocument();

    // Click the delete button
    await userEvent.click(deleteButton);

    // Verify the human instruction was removed
    await waitFor(() => {
      expect(screen.queryByText('Human instruction')).not.toBeInTheDocument();
    });
  });

  it('preserves active state of solution items', async () => {
    const solutionWithActiveStates = [
      {
        ...defaultSolution[0],
        is_active: true,
      },
      {
        title: 'Another step',
        code_snippet_and_analysis: 'More code',
        timeline_item_type: 'internal_code' as const,
        is_active: false,
        relevant_code_file: {
          file_path: 'src/another.js',
          repo_name: 'owner/repo',
        },
      },
    ] as AutofixSolutionTimelineEvent[];

    // Mock the API directly before the test
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });

    render(
      <AutofixSolution
        {...defaultProps}
        solution={solutionWithActiveStates}
        repos={[
          {
            name: 'owner/repo',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo',
            is_readable: true,
          },
        ]}
      />
    );

    // Click Code It Up
    await userEvent.click(screen.getByRole('button', {name: 'Code It Up'}));

    // Wait for API call
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalled();
    });

    // Verify payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/123/autofix/update/',
      expect.objectContaining({
        data: {
          run_id: 'run-123',
          payload: {
            type: 'select_solution',
            mode: 'fix',
            solution: expect.arrayContaining([
              expect.objectContaining({
                title: 'Fix the bug',
                is_active: true,
              }),
              expect.objectContaining({
                title: 'Another step',
                is_active: false,
              }),
            ]),
          },
        },
      })
    );
  });

  it('passes the solution array when selecting the dropdown options', async () => {
    // Mock the API directly before the test
    const mockApi = MockApiClient.addMockResponse({
      url: '/issues/123/autofix/update/',
      method: 'POST',
    });

    render(
      <AutofixSolution
        {...defaultProps}
        repos={[
          {
            name: 'owner/repo',
            default_branch: 'main',
            external_id: 'repo1',
            integration_id: 'integration1',
            provider: 'github',
            url: 'https://github.com/owner/repo',
            is_readable: true,
          },
        ]}
      />
    );

    // Open dropdown by clicking the More options button
    const dropdownButton = screen.getByRole('button', {name: 'More coding options'});
    await userEvent.click(dropdownButton);

    // Wait for the dropdown menu to appear and click the Write both option
    const writeOption = await screen.findByText('Write both');
    await userEvent.click(writeOption);

    // Wait for API call
    await waitFor(() => {
      expect(mockApi).toHaveBeenCalled();
    });

    // Verify payload
    expect(mockApi).toHaveBeenCalledWith(
      '/issues/123/autofix/update/',
      expect.objectContaining({
        data: {
          run_id: 'run-123',
          payload: {
            type: 'select_solution',
            mode: 'all',
            solution: expect.any(Array),
          },
        },
      })
    );
  });
});
