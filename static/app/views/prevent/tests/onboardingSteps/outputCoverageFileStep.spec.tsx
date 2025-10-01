import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {OutputCoverageFileStep} from 'sentry/views/prevent/tests/onboardingSteps/outputCoverageFileStep';

describe('OutputCoverageFileStep component', () => {
  it('renders Jest snippets by default', () => {
    render(<OutputCoverageFileStep step="1" />);

    // Check that Jest is selected by default
    expect(screen.getByText('Jest')).toBeInTheDocument();

    // Check Jest installation snippet
    expect(screen.getByText('npm install --save-dev jest')).toBeInTheDocument();
  });

  it('renders Vitest snippets when Vitest is selected', async () => {
    render(<OutputCoverageFileStep step="1" />);

    // Select Vitest
    const select = screen.getByText('Jest');
    await userEvent.click(select);
    await userEvent.click(screen.getByText('Vitest'));

    // Check that Vitest is selected
    expect(screen.getByText('Vitest')).toBeInTheDocument();

    // Check Vitest installation snippet
    expect(
      screen.getByText('npm install --save-dev vitest @vitest/coverage-v8')
    ).toBeInTheDocument();
  });

  it('renders Pytest snippets when Pytest is selected', async () => {
    render(<OutputCoverageFileStep step="1" />);

    // Select Pytest
    const select = screen.getByText('Jest');
    await userEvent.click(select);
    await userEvent.click(screen.getByText('Pytest'));

    // Check that Pytest is selected
    expect(screen.getByText('Pytest')).toBeInTheDocument();

    // Check Pytest installation snippet
    expect(screen.getByText('pip install pytest')).toBeInTheDocument();
    expect(
      screen.getByText('pytest --junitxml=junit.xml -o junit_family=legacy')
    ).toBeInTheDocument();
  });

  it('renders PHPUnit snippets when PHPUnit is selected', async () => {
    render(<OutputCoverageFileStep step="1" />);

    // Select PHPUnit
    const select = screen.getByText('Jest');
    await userEvent.click(select);
    await userEvent.click(screen.getByText('PHPUnit'));

    // Check that PHPUnit is selected
    expect(screen.getByText('PHPUnit')).toBeInTheDocument();

    // Check PHPUnit installation snippet
    expect(
      screen.getByText('composer require --dev phpunit/phpunit')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/\.\/vendor\/bin\/phpunit --log-junit junit.xml/)
    ).toBeInTheDocument();
  });

  it('renders all framework options in the select dropdown', async () => {
    render(<OutputCoverageFileStep step="1" />);

    const select = screen.getByText('Jest');
    await userEvent.click(select);

    // Check all options are present
    expect(screen.getAllByText('Jest')).toHaveLength(2);
    expect(screen.getByText('Vitest')).toBeInTheDocument();
    expect(screen.getByText('Pytest')).toBeInTheDocument();
    expect(screen.getByText('PHPUnit')).toBeInTheDocument();
  });
});
