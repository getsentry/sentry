import * as Sentry from '@sentry/react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {defineSeerEmbed} from './utils';

const data = {value: '2025-07-15T14:30:00Z', format: 'absolute'};

function Boom(): React.ReactNode {
  throw new Error('embed exploded');
}

const ThrowingEmbed = defineSeerEmbed({
  name: 'timestamp',
  render: () => <Boom />,
});

describe('defineSeerEmbed error boundary', () => {
  beforeEach(() => {
    // React logs the caught error; the boundary reporting it is what we assert.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Sentry, 'captureException').mockImplementation(() => '');
  });

  it('contains a throwing block embed behind an alert', () => {
    render(<ThrowingEmbed name="timestamp" data={data} level="block" />);

    expect(screen.getByText('Unable to render')).toBeInTheDocument();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('contains a throwing inline embed as text', () => {
    render(<ThrowingEmbed name="timestamp" data={data} level="inline" />);

    expect(screen.getByText('Unable to render')).toBeInTheDocument();
  });

  it('does not take the rest of the message down with it', () => {
    render(
      <div>
        <ThrowingEmbed name="timestamp" data={data} level="block" />
        <span>still here</span>
      </div>
    );

    expect(screen.getByText('still here')).toBeInTheDocument();
    expect(screen.getByText('Unable to render')).toBeInTheDocument();
  });
});
