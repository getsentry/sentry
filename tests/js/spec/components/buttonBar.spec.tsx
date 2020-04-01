import React from 'react';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {renderWithTheme} from 'sentry-test/reactTestingLibrary';
import theme from 'app/utils/theme';

// Please see: https://github.com/testing-library/react-testing-library/issues/379
import '@testing-library/jest-dom/extend-expect';

function renderComponent(active: '1' | '2' | '3' | '4') {
  const utils = renderWithTheme(
    <ButtonBar active={active} merged>
      <Button barId="1">First Button</Button>
      <Button barId="2" data-testid="buttonBar-secondButton">
        Second Button
      </Button>
      <Button data-testid="buttonBar-thirdButton">Third Button</Button>
      <Button barId="4">Fourth Button</Button>
    </ButtonBar>
  );
  return {...utils};
}

describe('ButtonBar', () => {
  it('has "Second Button" as the active button in the bar', () => {
    const {getByText, getByTestId} = renderComponent('2');
    expect(getByText('Second Button')).toBeTruthy();
    expect(getByTestId('buttonBar-secondButton')).toHaveStyle(
      `background-color: ${theme.button.primary.background}`
    );
  });

  it('does not pass `barId` down to the button', () => {
    const {getByText, getByTestId} = renderComponent('3');
    expect(getByText('Second Button')).toBeTruthy();
    expect(getByTestId('buttonBar-thirdButton')).not.toHaveStyle(
      `background-color: ${theme.button.primary.background}`
    );
  });
});
