import {useTheme} from '@emotion/react';

import {LinkButton, type LinkButtonProps} from 'sentry/components/core/button/linkButton';
import * as Storybook from 'sentry/stories';

import types from '!!type-loader!sentry/components/core/button';

export default Storybook.story('LinkButton', (story, APIReference) => {
  APIReference(types.LinkButton);

  story('Default', () => {
    const theme = useTheme();
    const variants = theme.isChonk
      ? ['default', 'transparent', 'primary', 'warning', 'danger', 'link']
      : ['default', 'transparent', 'primary', 'link', 'danger'];

    const propMatrix: Storybook.PropMatrix<LinkButtonProps> = {
      children: ['Delete', undefined],
      priority: variants as Array<LinkButtonProps['priority']>,
      size: ['md', 'sm', 'xs', 'zero'],
      disabled: [false, true],
      external: [false, true],
      title: [undefined, 'Delete this'],
      href: ['#'],
    };

    return (
      <div>
        <p>
          <Storybook.JSXNode name="LinkButton" /> is a component that renders a link with
          button styling. It accepts either a <code>to</code> prop with a location
          descriptor object for internal routing, or an <code>href</code> prop with a
          string URL for external links.
        </p>
        <Storybook.PropMatrix<LinkButtonProps>
          render={LinkButton}
          propMatrix={propMatrix}
          selectedProps={['size', 'priority']}
        />
      </div>
    );
  });
});
