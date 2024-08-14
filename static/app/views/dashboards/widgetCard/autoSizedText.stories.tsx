import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';

export default storyBook(AutoSizedText, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="AutoSizedText" /> is a helper component that automatically sizes
          a piece of text against its parent. It iteratively measures the size of the
          parent element, and chooses a font size for the child element to fit it
          perfectly (within reason) inside the parent. For example:
        </p>

        <SideBySide>
          <Fragment>
            <SmallSizingWindow>
              <AutoSizedText minFontSize={10} maxFontSize={600}>
                NEWSFLASH, y'all!
              </AutoSizedText>
            </SmallSizingWindow>
            <SmallSizingWindow>
              <AutoSizedText minFontSize={10} maxFontSize={600}>
                GASP!
              </AutoSizedText>
            </SmallSizingWindow>
          </Fragment>
        </SideBySide>

        <p>
          This was built for the "Big Number" widget in our Dashboards product. It's not
          possible to <i>perfectly</i> size the text using only CSS and HTML!
        </p>
        <p>
          To use <JSXNode name="AutoSizedText" />, set it as the child of positioned
          element of known dimensions. Pass the content you want to size as the{' '}
          <strong>
            <code>children</code>
          </strong>
          prop. <JSXNode name="AutoSizedText" /> will mimic the dimensions of the
          positioned element, and size its children to fit into itself.
        </p>
      </Fragment>
    );
  });

  story('Props', () => {
    return (
      <Fragment>
        <p>
          <ul>
            <li>
              <strong>
                <code>minFontSize</code>
              </strong>
              : An integer value for the minimum acceptable font size. This is mostly a
              safeguard, but it's a good idea to set this to something reasonable.
            </li>
            <li>
              <strong>
                <code>maxFontSize</code>
              </strong>
              : An integer value for the maximum acceptable font size. This is mostly a
              safeguard, and it should be safe to set this to either the known maximum
              height of the containing element, or some very high number.
            </li>
            <li>
              <strong>
                <code>calculationCountLimit</code>
              </strong>
              : An integer value for the number of iterations to run when attempting to
              fit the text. Increase this value for a more precise fit. Decrease this
              value for better performance, if you're sizing many elements.
            </li>
          </ul>
        </p>
      </Fragment>
    );
  });
});

const SmallSizingWindow = styled(SizingWindow)`
  width: 300px;
  height: 200px;
`;
