import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {TextArea} from '@sentry/scraps/textarea';

import * as Storybook from 'sentry/stories';

import {TextWidgetVisualization} from './textWidgetVisualization';

export default Storybook.story('TextWidgetVisualization', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TextWidgetVisualization" /> is a visualization used for
          Text widgets in Dashboards. It renders freeform text with full Markdown support,
          making it useful for adding notes, documentation, or context alongside your data
          widgets.
        </p>
        <p>
          It has features like:
          <ul>
            <li>
              Markdown rendering (headings, bold, italic, links, lists, code blocks)
            </li>
            <li>Empty state with an em dash placeholder when no text is provided</li>
            <li>Scrollable content area that fills its parent container</li>
          </ul>
          NOTE: The borders in this storybook are only for visual purposes and are not
          part the TextWidgetVisualization component. The visualization's constraints are
          imposed by its parent component.
        </p>
      </Fragment>
    );
  });

  story('Empty State', () => {
    return (
      <Fragment>
        <p>
          When the <code>text</code> prop is not provided (or an empty string is passed),{' '}
          <Storybook.JSXNode name="TextWidgetVisualization" /> renders a centered em dash
          placeholder.
        </p>
        <InvisibleWidgetFrame>
          <TextWidgetVisualization />
        </InvisibleWidgetFrame>
      </Fragment>
    );
  });

  story('Plain Text', () => {
    return (
      <Fragment>
        <p>Plain text is rendered as-is inside a scrollable container with padding.</p>
        <InvisibleWidgetFrame>
          <TextWidgetVisualization text="This is a plain text widget. Use it to add notes or context to your dashboard." />
        </InvisibleWidgetFrame>
      </Fragment>
    );
  });

  story('Markdown', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TextWidgetVisualization" /> supports full Markdown
          syntax including headings, emphasis, links, lists, and code blocks.
        </p>
        <Storybook.SideBySide>
          <div>
            <p>Headings &amp; emphasis</p>
            <InvisibleWidgetFrame>
              <TextWidgetVisualization
                text={`# Dashboard Notes\n\nThis widget shows **critical** metrics for the *payments* service.`}
              />
            </InvisibleWidgetFrame>
          </div>
          <div>
            <p>Links &amp; lists</p>
            <InvisibleWidgetFrame>
              <TextWidgetVisualization
                text={`## Runbook\n\n- Check the [error dashboard](https://sentry.io)\n- Review recent deploys\n- Page on-call if p99 > 500ms`}
              />
            </InvisibleWidgetFrame>
          </div>
          <div>
            <p>Code blocks</p>
            <InvisibleWidgetFrame>
              <TextWidgetVisualization
                text={"Query used:\n\n```sql\nSELECT *\nFROM foo\nWHERE bar = 'baz'\n```"}
              />
            </InvisibleWidgetFrame>
          </div>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Long Content', () => {
    return (
      <Fragment>
        <p>
          When the text content exceeds the parent container's height, the visualization
          container scrolls vertically.
        </p>
        <InvisibleWidgetFrame>
          <TextWidgetVisualization
            text={`# Section 1\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n# Section 2\n\nPellentesque habitant morbi tristique senectus et netus.\n\n# Section 3\n\nVivamus lacinia odio vitae vestibulum vestibulum.\n\n# Section 4\n\nDonec in efficitur leo, in commodo orci.`}
          />
        </InvisibleWidgetFrame>
      </Fragment>
    );
  });

  story('User Demo', () => {
    const [text, setText] = useState('');
    return (
      <Fragment>
        <p>
          Now try it out for yourself! Try adding some text/markdown into the text field
          and see how it renders in real-time.
        </p>
        <Storybook.SideBySide justify="between">
          <div>
            <p style={{fontWeight: 'bold'}}>Text</p>
            <TextArea
              value={text}
              onChange={e => setText(e.target.value)}
              style={{width: '300px', height: 300}}
            />
          </div>
          <div>
            <p style={{fontWeight: 'bold'}}>Markdown</p>
            <InvisibleWidgetFrame>
              <TextWidgetVisualization text={text} />
            </InvisibleWidgetFrame>
          </div>
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});

const InvisibleWidgetFrame = styled('div')`
  width: 400px;
  height: 300px;
  border: ${p => p.theme.border.md} dashed ${p => p.theme.colors.gray300};
  border-radius: ${p => p.theme.radius.md};
`;
