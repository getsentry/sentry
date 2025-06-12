import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Storybook from 'sentry/stories';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';

export default Storybook.story('AutoSizedText', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="AutoSizedText" /> is a helper component that
          automatically sizes a piece of text (single line only!) against its parent. It
          iteratively measures the size of the parent element, and chooses a font size for
          the child element to fit it perfectly (within reason) inside the parent. For
          example:
        </p>

        <SmallStorybookSizingWindow>
          <AutoSizedText>
            <OneLineSpan>NEWSFLASH, y'all!</OneLineSpan>
          </AutoSizedText>
        </SmallStorybookSizingWindow>

        <p>
          This was built for the "Big Number" widget in our Dashboards product. It's not
          possible to <i>perfectly</i> size the text using only CSS and HTML!
        </p>
        <p>
          To use <Storybook.JSXNode name="AutoSizedText" />, set it as the child of
          positioned element of known dimensions. Pass the content you want to size as the{' '}
          <strong>
            <code>children</code>
          </strong>
          prop. <Storybook.JSXNode name="AutoSizedText" /> will set the font size of its
          children to fit into the parent.
        </p>
      </Fragment>
    );
  });
});

const SmallStorybookSizingWindow = styled(Storybook.SizingWindow)`
  width: 300px;
  height: 200px;
`;

const OneLineSpan = styled('span')`
  white-space: nowrap;
`;
