import {Fragment} from 'react';

import CollapsePanel from 'sentry/components/collapsePanel';
import * as Storybook from 'sentry/stories';

export default Storybook.story('CollapsePanel', story => {
  story('Basics', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="CollapsePanel" /> expanded state will be set based on
        whether <Storybook.JSXProperty name="items" value={Number} /> is larger than{' '}
        <Storybook.JSXProperty name="collapseCount" value={Number} /> (default: 5).
      </p>
      <p>
        Once expanded, <Storybook.JSXNode name="CollapsePanel" /> cannot be collapsed
        again.
      </p>
      <Storybook.SizingWindow display="block">
        <CollapsePanel items={6}>
          {({isExpanded, showMoreButton}) => (
            <Fragment>
              <p>isExpanded = {String(isExpanded)}</p>
              {showMoreButton}
            </Fragment>
          )}
        </CollapsePanel>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Bugs', () => (
    <Fragment>
      <p>
        Starting with items less than or equal to the <var>collapseCount</var> will return
        an incorrect <var>isExpanded</var> value.
      </p>
      <Storybook.SideBySide>
        {[6, 5, 4].map(items => (
          <Fragment key={items}>
            <Storybook.JSXNode name="CollapsePanel" props={{items, collapseCount: 5}} />
            <Storybook.SizingWindow display="block">
              <CollapsePanel items={items} collapseCount={5}>
                {({isExpanded, showMoreButton}) => (
                  <Fragment>
                    <p>isExpanded = {String(isExpanded)}</p>
                    {showMoreButton}
                  </Fragment>
                )}
              </CollapsePanel>
            </Storybook.SizingWindow>
          </Fragment>
        ))}
      </Storybook.SideBySide>
    </Fragment>
  ));

  story('Rendering a list', () => {
    const allItems = ['one', 'two', 'three', 'four', 'five'];
    const collapseCount = 3; // Show 3 items to start
    return (
      <Fragment>
        <p>
          Typically you will render a portion of the list when the panel is collapsed,
          then all items when the panel is expanded.
        </p>
        <Storybook.SizingWindow display="block">
          <CollapsePanel items={allItems.length} collapseCount={collapseCount}>
            {({isExpanded, showMoreButton}) => {
              const items = isExpanded ? allItems : allItems.slice(0, collapseCount);
              return (
                <Fragment>
                  <ul>
                    {items.map(item => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  {showMoreButton}
                </Fragment>
              );
            }}
          </CollapsePanel>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Props', () => (
    <Storybook.PropMatrix
      render={CollapsePanel}
      propMatrix={{
        buttonTitle: [undefined, 'Custom Title'],
        collapseCount: [0],
        disableBorder: [true, false],
        items: [1],
        children: [
          ({isExpanded, showMoreButton}) => (
            <Fragment>
              <p>isExpanded = {String(isExpanded)}</p>
              {showMoreButton}
            </Fragment>
          ),
        ],
      }}
      selectedProps={['buttonTitle', 'disableBorder']}
      // sizingWindowProps={{display: 'block'}}
    />
  ));
});
