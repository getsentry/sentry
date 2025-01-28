import {Fragment} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook(EmptyStateWarning, story => {
  story('Default', () => (
    <Fragment>
      <p>
        The default <code>EmptyStateWarning</code> looks like this, with a large icon.
      </p>
      <EmptyStateWarning />
    </Fragment>
  ));

  story('Props', () => (
    <Fragment>
      <p>
        You can also pass in several props:{' '}
        <ul>
          <li>
            <code>small</code> determines the icon size.
          </li>
          <li>
            <code>withIcon</code> hides the icon if set to <code>false</code>.
          </li>
          <li>You can also pass in children in combination with icon or no icon.</li>
        </ul>
      </p>
      <h3>
        <JSXProperty name="small" value={`true`} />
      </h3>
      <EmptyStateWarning small />
      <h3>
        <JSXProperty name="small" value={`true`} /> with children
      </h3>
      <EmptyStateWarning small>No results found.</EmptyStateWarning>
      <h3>
        <JSXProperty name="small" value={`false`} /> with children (with styling)
      </h3>
      <StyledEmptyStateWarning>No results found.</StyledEmptyStateWarning>
    </Fragment>
  ));
});

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-items: center;
`;
