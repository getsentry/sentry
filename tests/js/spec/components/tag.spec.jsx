import {
  cleanup,
  fireEvent,
  mountWithTheme,
  screen,
} from 'sentry-test/reactTestingLibrary';

import Tag from 'app/components/tag';
import {IconFire} from 'app/icons';

describe('Tag', function () {
  it('basic', function () {
    mountWithTheme(<Tag>Text</Tag>);
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('with icon', function () {
    mountWithTheme(
      <Tag icon={<IconFire data-test-id="icon-fire" />} type="error">
        Error
      </Tag>
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByTestId('icon-fire')).toBeInTheDocument();
  });

  it('with tooltip', async function () {
    mountWithTheme(
      <Tag type="highlight" tooltipText="lorem ipsum">
        Tooltip
      </Tag>
    );
    expect(screen.getByText('Tooltip')).toBeInTheDocument();
    fireEvent.mouseOver(screen.getByText('Tooltip'));
    expect(await screen.findByText('lorem ipsum')).toBeInTheDocument();
  });

  it('with dismiss', function () {
    const mockCallback = jest.fn();

    mountWithTheme(
      <Tag type="highlight" onDismiss={mockCallback}>
        Dismissable
      </Tag>
    );
    expect(screen.getByText('Dismissable')).toBeInTheDocument();
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();

    expect(mockCallback).toHaveBeenCalledTimes(0);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('with internal link', function () {
    const to = '/organizations/sentry/issues/';
    mountWithTheme(
      <Tag type="highlight" to={to} iconsProps={{'data-test-id': 'icon-open'}}>
        Internal link
      </Tag>
    );
    expect(screen.getByText('Internal link')).toBeInTheDocument();
    expect(screen.getByTestId('tag-open')).toBeInTheDocument();
    expect(screen.getByTestId('tag-highlight').parentElement).toHaveAttribute('href', to);
  });

  it('with external link', function () {
    const href = 'https://sentry.io/';
    mountWithTheme(
      <Tag type="highlight" href={href}>
        External link
      </Tag>
    );
    expect(screen.getByText('External link')).toBeInTheDocument();
    expect(screen.getByTestId('tag-open')).toBeInTheDocument();
    const link = screen.getByTestId('tag-highlight').parentElement;
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('overrides a link default icon', function () {
    mountWithTheme(<Tag href="#">1</Tag>);
    expect(screen.getByTestId('tag-open')).toBeInTheDocument();
    cleanup();

    mountWithTheme(
      <Tag href="#" icon={null}>
        2
      </Tag>
    );
    expect(screen.queryByTestId('tag-open')).not.toBeInTheDocument();
    cleanup();

    mountWithTheme(
      <Tag href="#" icon={<IconFire data-test-id="icon-fire" />}>
        3
      </Tag>
    );
    expect(screen.getByTestId('icon-fire')).toBeInTheDocument();
  });
});
