import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button} from 'sentry/components/button';
import {InputGroup} from 'sentry/components/inputGroup';

describe('InputGroup', function () {
  it('renders input', function () {
    const {container} = render(
      <InputGroup>
        <InputGroup.Input value="Search" onChange={() => {}} />
      </InputGroup>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveDisplayValue('Search');

    expect(container).toSnapshot();
  });

  it('renders disabled input', function () {
    const {container} = render(
      <InputGroup>
        <InputGroup.Input disabled />
      </InputGroup>
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(container).toSnapshot();
  });

  it('renders leading elements', function () {
    const {container} = render(
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
    userEvent.tab();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toHaveFocus();
    userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();

    expect(container).toSnapshot();
  });

  it('renders trailing elements', function () {
    const {container} = render(
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
    userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
    userEvent.tab();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toHaveFocus();

    expect(container).toSnapshot();
  });
});
