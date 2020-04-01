import React from 'react';

import Confirm from 'app/components/confirm';
import {renderWithTheme, fireEvent} from 'sentry-test/reactTestingLibrary';

function renderComponent(onConfirm = jest.fn()) {
  const utils = renderWithTheme(
    <Confirm message="Are you sure?" onConfirm={onConfirm}>
      <button data-testid="confirm-button-children">Confirm?</button>
    </Confirm>
  );
  return {...utils};
}

describe('Confirm', () => {
  it('renders', () => {
    const {container} = renderComponent();
    expect(container.firstChild).toMatchSnapshot();
  });

  it('clicking on the child button opens Modal', () => {
    const {getByTestId} = renderComponent();
    fireEvent.click(getByTestId('confirm-button-children'));
    expect('confirm-modal').toBeTruthy();
  });

  it('clicking action button twice causes Modal to end up closed', () => {
    const {getByTestId, queryByTestId} = renderComponent();
    fireEvent.click(getByTestId('confirm-button-children'));
    fireEvent.click(getByTestId('confirm-button-children'));
    expect(queryByTestId('confirm-modal')).toBeNull();
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', () => {
    const handleConfirmMock = jest.fn();
    const {getByTestId, getByText, queryByTestId} = renderComponent(handleConfirmMock);
    expect(handleConfirmMock).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('confirm-button-children'));
    expect(getByTestId('confirm-modal')).toBeTruthy();
    fireEvent.click(getByText('Confirm'));
    expect(handleConfirmMock).toHaveBeenCalledTimes(1);
    expect(queryByTestId('confirm-modal')).toBeNull();
  });

  test('can stop propagation on the event', () => {
    // Please see: https://github.com/testing-library/react-testing-library/issues/572

    const handleConfirmMock = jest.fn();
    const handleStopPropagation = jest.fn();

    const {getByTestId} = renderWithTheme(
      <div onClick={handleStopPropagation}>
        <Confirm message="Are you sure?" onConfirm={handleConfirmMock} stopPropagation>
          <button data-testid="confirm-button-children">Confirm?</button>
        </Confirm>
      </div>
    );

    fireEvent.click(getByTestId('confirm-button-children'));
    expect(handleStopPropagation).toHaveBeenCalledTimes(0);
  });
});
