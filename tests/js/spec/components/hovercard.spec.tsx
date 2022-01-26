import * as React from 'react';
import {act, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {Hovercard, HOVERCARD_PORTAL_ID} from 'sentry/components/hovercard';

describe('Hovercard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reuses portal', () => {
    mountWithTheme(
      <React.Fragment>
        <Hovercard
          position="top"
          body="Hovercard Body"
          header="Hovercard Header"
          displayTimeout={0}
        >
          Hovercard Trigger
        </Hovercard>
        <Hovercard
          position="top"
          body="Hovercard Body"
          header="Hovercard Header"
          displayTimeout={0}
        >
          Hovercard Trigger
        </Hovercard>
      </React.Fragment>
    );

    // eslint-disable-next-line
    expect(document.querySelectorAll(`#${HOVERCARD_PORTAL_ID}`)).toHaveLength(1);
  });
  it('Displays card', async () => {
    mountWithTheme(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={0}
      >
        Hovercard Trigger
      </Hovercard>
    );

    userEvent.hover(screen.getByText('Hovercard Trigger'));

    expect(await screen.findByText(/Hovercard Body/)).toBeInTheDocument();
    expect(await screen.findByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('Does not display card', async () => {
    mountWithTheme(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={0}
        show={false}
      >
        Hovercard Trigger
      </Hovercard>
    );

    userEvent.hover(screen.getByText('Hovercard Trigger'));
    jest.runAllTimers();

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();
  });

  it('Always displays card', async () => {
    mountWithTheme(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={0}
        show
      >
        Hovercard Trigger
      </Hovercard>
    );

    expect(screen.getByText(/Hovercard Body/)).toBeInTheDocument();
    expect(screen.getByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('Respects displayTimeout displays card', async () => {
    mountWithTheme(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={100}
      >
        Hovercard Trigger
      </Hovercard>
    );

    userEvent.hover(screen.getByText('Hovercard Trigger'));

    act(() => {
      jest.advanceTimersByTime(99);
    });

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText(/Hovercard Body/)).toBeInTheDocument();
    expect(screen.getByText(/Hovercard Header/)).toBeInTheDocument();
  });

  it('Doesnt leak timeout', async () => {
    mountWithTheme(
      <Hovercard
        position="top"
        body="Hovercard Body"
        header="Hovercard Header"
        displayTimeout={100}
      >
        Hovercard Trigger
      </Hovercard>
    );

    userEvent.hover(screen.getByText('Hovercard Trigger'));

    act(() => {
      jest.advanceTimersByTime(99);
    });

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();

    userEvent.unhover(screen.getByText('Hovercard Trigger'));

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(screen.queryByText(/Hovercard Body/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hovercard Header/)).not.toBeInTheDocument();
  });
});
