import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';

describe('InputGroup', () => {
  it('renders input', () => {
    render(
      <InputGroup>
        <InputGroup.Input value="Search" onChange={() => {}} />
      </InputGroup>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveDisplayValue('Search');
  });

  it('renders disabled input', () => {
    render(
      <InputGroup>
        <InputGroup.Input disabled />
      </InputGroup>
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders leading elements', async () => {
    render(
      <InputGroup>
        <InputGroup.LeadingItems>
          <Button>Leading Button</Button>
        </InputGroup.LeadingItems>
        <InputGroup.Input />
      </InputGroup>
    );

    // Leading button is rendered
    expect(screen.getByTestId('input-leading-items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toBeInTheDocument();

    // Focus moves first to leading button and then to input
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('renders trailing elements', async () => {
    render(
      <InputGroup>
        <InputGroup.Input />
        <InputGroup.TrailingItems>
          <Button>Trailing Button</Button>
        </InputGroup.TrailingItems>
      </InputGroup>
    );

    // Trailing button is rendered
    expect(screen.getByTestId('input-trailing-items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toBeInTheDocument();

    // Focus moves first to input and then to trailing button
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toHaveFocus();
  });
});
