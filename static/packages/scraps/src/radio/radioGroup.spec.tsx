import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {RadioGroup} from '@sentry/scraps/radio';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('RadioGroup', () => {
  it('renders', () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={jest.fn()}
      />,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('radiogroup', {name: 'test'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'Choice Two'})).not.toBeChecked();
  });

  it('renders descriptions', () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[['choice_one', 'Choice One', 'First choice description']]}
        onChange={jest.fn()}
      />,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByText('First choice description')).toBeInTheDocument();
  });

  it('renders disabled', () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        disabled
        choices={[['choice_one', 'Choice One']]}
        onChange={jest.fn()}
      />,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeDisabled();
  });

  it('renders disabled choice', async () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
        ]}
        disabledChoices={[['choice_two', 'Reason why choice two is disabled']]}
        onChange={jest.fn()}
      />,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeEnabled();
    expect(screen.getByRole('radio', {name: 'Choice Two'})).toBeDisabled();

    await userEvent.hover(screen.getByRole('radio', {name: 'Choice Two'}));
    expect(
      await screen.findByText('Reason why choice two is disabled')
    ).toBeInTheDocument();
  });

  it('calls onChange when clicked', async () => {
    const mock = jest.fn();

    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={mock}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('radio', {name: 'Choice Three'}));
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith('choice_three', expect.anything());
  });

  it('does not call onChange for a disabled choice', async () => {
    const mock = jest.fn();

    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
        ]}
        disabledChoices={[['choice_two']]}
        onChange={mock}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByText('Choice Two'));
    expect(mock).not.toHaveBeenCalled();
  });
});
