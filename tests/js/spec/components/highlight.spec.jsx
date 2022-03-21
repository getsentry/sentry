import {render, screen} from 'sentry-test/reactTestingLibrary';

import {HighlightComponent} from 'sentry/components/highlight';

describe('Highlight', function () {
  it('highlights text', function () {
    const wrapper = render(
      <HighlightComponent text="ILL">billy@sentry.io</HighlightComponent>
    );
    expect(wrapper.container.childNodes).toHaveLength(3);
    expect(wrapper.container.childNodes[0]).toHaveTextContent('b');
    expect(wrapper.container.childNodes[1]).toHaveTextContent('ill');
    expect(wrapper.container.childNodes[2]).toHaveTextContent('y@sentry.io');
  });

  it('does not have highlighted text if `text` prop is not found in main text', function () {
    render(<HighlightComponent text="invalid">billy@sentry.io</HighlightComponent>);

    expect(screen.getByText('billy@sentry.io')).toBeInTheDocument();
  });

  it('does not have highlighted text if `text` prop is empty', function () {
    render(<HighlightComponent text="">billy@sentry.io</HighlightComponent>);

    expect(screen.getByText('billy@sentry.io')).toBeInTheDocument();
  });

  it('does not have highlighted text if `disabled` prop is true', function () {
    render(<HighlightComponent text="">billy@sentry.io</HighlightComponent>);

    expect(screen.getByText('billy@sentry.io')).toBeInTheDocument();
  });
});
