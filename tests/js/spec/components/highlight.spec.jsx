import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {HighlightComponent} from 'sentry/components/highlight';

describe('Highlight', function () {
  it('highlights text', function () {
    const wrapper = mountWithTheme(
      <HighlightComponent text="ILL">billy@sentry.io</HighlightComponent>
    );
    expect(wrapper.container.childNodes).toHaveLength(3);
    expect(wrapper.container.childNodes[0]).toHaveTextContent('b');
    expect(wrapper.container.childNodes[1]).toHaveTextContent('ill');
    expect(wrapper.container.childNodes[2]).toHaveTextContent('y@sentry.io');
  });

  it('does not have highlighted text if `text` prop is not found in main text', function () {
    mountWithTheme(
      <HighlightComponent text="invalid">billy@sentry.io</HighlightComponent>
    );

    expect(screen.getByText('billy@sentry.io')).toBeInTheDocument();
  });

  it('does not have highlighted text if `text` prop is empty', function () {
    mountWithTheme(<HighlightComponent text="">billy@sentry.io</HighlightComponent>);

    expect(screen.getByText('billy@sentry.io')).toBeInTheDocument();
  });

  it('does not have highlighted text if `disabled` prop is true', function () {
    mountWithTheme(<HighlightComponent text="">billy@sentry.io</HighlightComponent>);

    expect(screen.getByText('billy@sentry.io')).toBeInTheDocument();
  });
});
