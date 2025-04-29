import {useTheme} from '@emotion/react';

import {LinkButton, type LinkButtonProps} from 'sentry/components/core/button';
import JSXNode from 'sentry/components/stories/jsxNode';
import Matrix, {type PropMatrix} from 'sentry/components/stories/matrix';
import storyBook from 'sentry/stories/storyBook';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/button';

export default storyBook('LinkButton', (story, APIReference) => {
  APIReference(types.LinkButton);

  story('Default', () => {
    const theme = useTheme();
    const variants = theme.isChonk
      ? ['default', 'transparent', 'primary', 'warning', 'danger', 'link']
      : ['default', 'primary', 'link', 'danger'];

    const propMatrix: PropMatrix<LinkButtonProps> = {
      children: ['Delete', undefined],
      priority: variants as Array<LinkButtonProps['priority']>,
      size: ['md', 'sm', 'xs', 'zero'],
      disabled: [false, true],
      external: [false, true],
      title: [undefined, 'Delete this'],
    };

    return (
      <div>
        <p>
          <JSXNode name="LinkButton" /> is a component that renders a link with button
          styling. It accepts either a <code>to</code> prop with a location descriptor
          object for internal routing, or an <code>href</code> prop with a string URL for
          external links.
        </p>
        <Matrix<LinkButtonProps>
          render={LinkButton}
          propMatrix={propMatrix}
          selectedProps={['size', 'priority']}
        />
      </div>
    );
  });
});
