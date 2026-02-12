import {act, render, screen} from 'sentry-test/reactTestingLibrary';
import type React from 'react';

import RotatingContent from './rotatingContent';

let capturedOnAnimationComplete: (() => void) | null = null;

// Mock framer-motion to capture animation completion callback
jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: jest.fn(({children}) => children),
    motion: {
      ...actual.motion,
      div: jest.fn(
        ({
          children,
          onAnimationComplete,
          ...props
        }: {
          children: React.ReactNode;
          onAnimationComplete?: () => void;
        }) => {
          capturedOnAnimationComplete = onAnimationComplete ?? null;
          return <div {...props}>{children}</div>;
        }
      ),
    },
  };
});

describe('RotatingContent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the first child initially', () => {
    render(
      <RotatingContent>
        <span>First</span>
        <span>Second</span>
        <span>Third</span>
      </RotatingContent>
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(screen.queryByText('Third')).not.toBeInTheDocument();
  });

  it('rotates to the next child after animation completes', () => {
    render(
      <RotatingContent>
        <span>First</span>
        <span>Second</span>
        <span>Third</span>
      </RotatingContent>
    );

    expect(screen.getByText('First')).toBeInTheDocument();

    // Simulate animation completion to move to next child
    act(() => {
      capturedOnAnimationComplete?.();
    });

    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.queryByText('First')).not.toBeInTheDocument();

    // Simulate animation completion again to move to third child
    act(() => {
      capturedOnAnimationComplete?.();
    });

    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
  });

  it('loops back to the first child after reaching the end', () => {
    render(
      <RotatingContent>
        <span>First</span>
        <span>Second</span>
      </RotatingContent>
    );

    expect(screen.getByText('First')).toBeInTheDocument();

    act(() => {
      capturedOnAnimationComplete?.();
    });
    expect(screen.getByText('Second')).toBeInTheDocument();

    act(() => {
      capturedOnAnimationComplete?.();
    });
    expect(screen.getByText('First')).toBeInTheDocument();
  });

  it('renders nothing when no children are provided', () => {
    const {container} = render(<RotatingContent>{null}</RotatingContent>);

    expect(container.firstChild).toBeNull();
  });

  it('does not rotate when only one child is provided', () => {
    render(
      <RotatingContent>
        <span>Only Child</span>
      </RotatingContent>
    );

    expect(screen.getByText('Only Child')).toBeInTheDocument();

    // Trigger animation complete, should not change
    act(() => {
      capturedOnAnimationComplete?.();
    });

    expect(screen.getByText('Only Child')).toBeInTheDocument();
  });

  it('can unmount without errors', () => {
    const {unmount} = render(
      <RotatingContent>
        <span>First</span>
        <span>Second</span>
      </RotatingContent>
    );

    expect(screen.getByText('First')).toBeInTheDocument();

    expect(() => unmount()).not.toThrow();
  });
});
