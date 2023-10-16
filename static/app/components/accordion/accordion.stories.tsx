import {Fragment, useState} from 'react';

import Accordion from 'sentry/components/accordion/accordion';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

const ACCORDION_ITEMS = [
  {header: () => 'Header 1', content: () => 'Content 1'},
  {header: () => 'Header 2', content: () => 'Content 2'},
  {header: () => 'Header 3', content: () => 'Content 3'},
];

export default storyBook(Accordion, story => {
  story('Default', () => {
    const [expanded, setExpanded] = useState(0);
    return (
      <Fragment>
        <p>
          The <JSXNode name="Accordion" /> component is
          <JSXProperty name="collapsible" value /> and has the chevron button on the right
          by default.
        </p>
        <SizingWindow display="block">
          <Accordion
            items={ACCORDION_ITEMS}
            expandedIndex={expanded}
            setExpandedIndex={setExpanded}
          />
        </SizingWindow>
        <p>Besides the accordion headers and content, required props to pass in are</p>
        <ul>
          <li>
            <JSXProperty name="expandedIndex" value={Number} /> to set the default
            expanded panel (the top panel is indexed <code>0</code>). To set all panels as
            collapsed, you can set
            <JSXProperty name="expandedIndex" value={-1} />.
          </li>
          <li>
            <JSXProperty name="setExpandedIndex" value={Function} /> - a callback which
            details the behavior when setting a new expanded panel.
          </li>
        </ul>
      </Fragment>
    );
  });

  story('Props', () => {
    const [expanded, setExpanded] = useState(0);
    const [collapsibleExpanded, setCollapsibleExpanded] = useState(0);
    const [leftExpanded, setLeftExpanded] = useState(0);
    const [rightExpanded, setRightExpanded] = useState(0);
    return (
      <Fragment>
        <p>
          <JSXProperty name="items" value={Array} /> specifies the accordion content. Each
          array item should specify a <code>ReactNode</code> for the header and content.
        </p>
        <SideBySide>
          {[true, false].map(collapsible => (
            <div key={'collapsible_' + collapsible}>
              <p>
                <JSXProperty name="collapsible" value={collapsible} />
              </p>
              <SizingWindow display="block">
                <Accordion
                  items={ACCORDION_ITEMS}
                  expandedIndex={collapsible ? collapsibleExpanded : expanded}
                  setExpandedIndex={collapsible ? setCollapsibleExpanded : setExpanded}
                  collapsible={collapsible}
                />
              </SizingWindow>
            </div>
          ))}
        </SideBySide>
        <br />
        <SideBySide>
          {[true, false].map(buttoOnLeft => (
            <div key={'left_' + buttoOnLeft}>
              <p>
                <JSXProperty name="buttoOnLeft" value={buttoOnLeft} />
              </p>
              <SizingWindow display="block">
                <Accordion
                  items={ACCORDION_ITEMS}
                  expandedIndex={buttoOnLeft ? leftExpanded : rightExpanded}
                  setExpandedIndex={buttoOnLeft ? setLeftExpanded : setRightExpanded}
                  buttonOnLeft={buttoOnLeft}
                />
              </SizingWindow>
            </div>
          ))}
        </SideBySide>
      </Fragment>
    );
  });
});
