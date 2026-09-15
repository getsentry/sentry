import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IconCheckmark} from 'sentry/icons';

import {IconText} from './iconText';

describe('IconText', () => {
  it('renders icon and text content', () => {
    render(<IconText icon={<IconCheckmark data-test-id="icon" />}>Hello world</IconText>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('resolves named icon size tokens to CSS lengths', () => {
    render(
      <IconText icon={<IconCheckmark data-test-id="icon" />} iconSize="xs">
        Content
      </IconText>
    );
    expect(screen.getByTestId('icon').parentElement).toHaveStyle({
      '--icon-text-size': '12px',
    });
  });

  it('defaults iconSize to md (16px)', () => {
    render(<IconText icon={<IconCheckmark data-test-id="icon" />}>Content</IconText>);
    expect(screen.getByTestId('icon').parentElement).toHaveStyle({
      '--icon-text-size': '16px',
    });
  });

  it('forwards props to the outer container', () => {
    render(
      <IconText icon={<IconCheckmark />} data-test-id="wrapper">
        Content
      </IconText>
    );
    expect(screen.getByTestId('wrapper')).toBeInTheDocument();
  });
});
