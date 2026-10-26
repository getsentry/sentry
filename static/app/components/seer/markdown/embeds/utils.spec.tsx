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

const WorkingEmbed = defineSeerEmbed({
  name: 'timestamp',
  render: () => <span>Jul 15, 2025 10:30 AM</span>,
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

  it('renders nothing for a throwing inline embed', () => {
    const {container} = render(
      <ThrowingEmbed name="timestamp" data={data} level="inline" />
    );

    // An alert inside a sentence would break the prose around it.
    expect(container).toBeEmptyDOMElement();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('drops a throwing embed from the copied text rather than crashing it', () => {
    // The markdown pass is read back as `textContent` for the clipboard, so a
    // fallback message here would be pasted into the user's reply.
    const {container} = render(
      <ThrowingEmbed name="timestamp" data={data} level="markdown" />
    );

    expect(container).toBeEmptyDOMElement();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('leaves a working markdown embed untouched', () => {
    const {container} = render(
      <WorkingEmbed name="timestamp" data={data} level="markdown" />
    );

    expect(container).toHaveTextContent('Jul 15, 2025 10:30 AM');
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
