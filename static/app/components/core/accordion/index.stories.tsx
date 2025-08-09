import {Fragment, useState} from 'react';

import * as Storybook from 'sentry/stories';

import {Accordion} from '.';

export default Storybook.story('Accordion', story => {
  const ACCORDION_ITEMS = [
    {
      id: 'general',
      title: 'General Information',
      content: (
        <div>
          <p>
            This accordion provides a clean, composable API for creating collapsible
            content sections.
          </p>
          <p>
            Each accordion item can contain any React content and supports proper
            accessibility features.
          </p>
        </div>
      ),
    },
    {
      id: 'features',
      title: 'Key Features',
      content: (
        <ul>
          <li>Composable API with Accordion.Item, Accordion.Header, etc.</li>
          <li>Support for single or multiple open items</li>
          <li>Controlled and uncontrolled modes</li>
          <li>Keyboard navigation and accessibility</li>
          <li>Smooth animations</li>
        </ul>
      ),
    },
    {
      id: 'usage',
      title: 'Usage Guidelines',
      content: (
        <div>
          <p>Use accordions when you need to:</p>
          <ul>
            <li>Display content in a limited space</li>
            <li>Organize related information into sections</li>
            <li>Allow users to focus on specific topics</li>
            <li>Reduce cognitive load with progressive disclosure</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'disabled',
      title: 'Disabled Item',
      content: <p>This content would be shown if the item was enabled.</p>,
      disabled: true,
    },
  ];

  story('Default (Single Open)', () => (
    <Fragment>
      <p>
        By default, only one accordion item can be open at a time. Use{' '}
        <Storybook.JSXNode name="Accordion.Item" props={{value: String}} /> to identify
        each item.
      </p>
      <Storybook.SizingWindow>
        <Accordion>
          {ACCORDION_ITEMS.map(item => (
            <Accordion.Item key={item.id} value={item.id} disabled={item.disabled}>
              <Accordion.Header>
                <Accordion.Trigger>{item.title}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{item.content}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Allow Multiple Open', () => (
    <Fragment>
      <p>
        Set <Storybook.JSXNode name="Accordion" props={{allowMultiple: true}} /> to allow
        multiple items to be open simultaneously.
      </p>
      <Storybook.SizingWindow>
        <Accordion allowMultiple>
          {ACCORDION_ITEMS.map(item => (
            <Accordion.Item key={item.id} value={item.id} disabled={item.disabled}>
              <Accordion.Header>
                <Accordion.Trigger>{item.title}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{item.content}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Default Open Items', () => (
    <Fragment>
      <p>
        Use <Storybook.JSXNode name="Accordion" props={{defaultValue: ['string']}} /> to
        specify which items should be open initially.
      </p>
      <Storybook.SizingWindow>
        <Accordion defaultValue={['general', 'features']} allowMultiple>
          {ACCORDION_ITEMS.map(item => (
            <Accordion.Item key={item.id} value={item.id} disabled={item.disabled}>
              <Accordion.Header>
                <Accordion.Trigger>{item.title}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel>{item.content}</Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Controlled Mode', () => {
    const [openItems, setOpenItems] = useState(['features']);

    return (
      <Fragment>
        <p>
          Control the accordion state externally using{' '}
          <Storybook.JSXNode
            name="Accordion"
            props={{value: ['string'], onChange: Function}}
          />
          .
        </p>
        <p>Current open items: {openItems.join(', ') || 'none'}</p>
        <button
          type="button"
          onClick={() => setOpenItems(openItems.length > 0 ? [] : ['general', 'usage'])}
        >
          {openItems.length > 0 ? 'Close All' : 'Open General & Usage'}
        </button>
        <br />
        <br />
        <Storybook.SizingWindow>
          <Accordion value={openItems} onChange={setOpenItems} allowMultiple>
            {ACCORDION_ITEMS.map(item => (
              <Accordion.Item key={item.id} value={item.id} disabled={item.disabled}>
                <Accordion.Header>
                  <Accordion.Trigger>{item.title}</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel>{item.content}</Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Disabled Items', () => (
    <Fragment>
      <p>
        Use <Storybook.JSXNode name="Accordion.Item" props={{disabled: true}} /> to
        disable specific accordion items. Disabled items cannot be opened and are visually
        indicated.
      </p>
      <Storybook.SizingWindow>
        <Accordion>
          <Accordion.Item value="enabled-1">
            <Accordion.Header>
              <Accordion.Trigger>Enabled Item 1</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>This item is enabled and can be opened.</Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="disabled-1" disabled>
            <Accordion.Header>
              <Accordion.Trigger>Disabled Item</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              This content is inaccessible due to disabled state.
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="enabled-2">
            <Accordion.Header>
              <Accordion.Trigger>Enabled Item 2</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              This item is also enabled and can be opened.
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Custom Content', () => (
    <Fragment>
      <p>
        Accordion items can contain any React content in both the trigger and panel
        sections.
      </p>
      <Storybook.SizingWindow>
        <Accordion allowMultiple>
          <Accordion.Item value="form">
            <Accordion.Header>
              <Accordion.Trigger>📝 Form Example</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              <form>
                <p>
                  <label htmlFor="email">Email:</label>
                  <input id="email" type="email" />
                </p>
                <p>
                  <label htmlFor="message">Message:</label>
                  <textarea id="message" rows={3} />
                </p>
                <button type="submit">Submit</button>
              </form>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="list">
            <Accordion.Header>
              <Accordion.Trigger>📋 List Example</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              <ul>
                <li>First item</li>
                <li>Second item</li>
                <li>Third item</li>
              </ul>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="mixed">
            <Accordion.Header>
              <Accordion.Trigger>
                <span>Mixed Content</span>
                <small> (complex trigger)</small>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              <h4>Section Title</h4>
              <p>
                This demonstrates that panels can contain any markup including headings,
                paragraphs, and other elements.
              </p>
              <blockquote>Even blockquotes work perfectly fine.</blockquote>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('Layout Stability Test', () => (
    <Fragment>
      <p>
        This test demonstrates that the accordion doesn't cause layout shifts when
        opened/closed. Notice how the content below stays in place when accordion items
        are toggled.
      </p>
      <Storybook.SizingWindow>
        <Accordion>
          <Accordion.Item value="long-content">
            <Accordion.Header>
              <Accordion.Trigger>Long Content Test</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              <p>
                This is a very long piece of content that might normally cause layout
                shifts when opened. Lorem ipsum dolor sit amet, consectetur adipiscing
                elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
              <p>
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
                aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
                voluptate velit esse cillum dolore eu fugiat nulla pariatur.
              </p>
              <p>
                <strong>Wide content that could cause horizontal expansion:</strong>
                This content has been designed to test whether the accordion properly
                constrains width and prevents horizontal layout shifts during animation.
              </p>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="table-content">
            <Accordion.Header>
              <Accordion.Trigger>Table Content</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Item 1</td>
                    <td>123</td>
                    <td>Test description</td>
                  </tr>
                  <tr>
                    <td>Item 2</td>
                    <td>456</td>
                    <td>Another description</td>
                  </tr>
                </tbody>
              </table>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <p>
          <strong>Fixed reference point:</strong> This content should not move when
          accordion items are opened or closed above.
        </p>
      </Storybook.SizingWindow>
    </Fragment>
  ));

  story('API Reference', () => (
    <Fragment>
      <h3>Components</h3>
      <ul>
        <li>
          <code>{'<Accordion>'}</code> - Root container that manages accordion state
        </li>
        <li>
          <code>{'<Accordion.Item>'}</code> - Individual accordion item wrapper
        </li>
        <li>
          <code>{'<Accordion.Header>'}</code> - Header container for the trigger
        </li>
        <li>
          <code>{'<Accordion.Trigger>'}</code> - Clickable element that toggles the panel
        </li>
        <li>
          <code>{'<Accordion.Panel>'}</code> - Collapsible content container
        </li>
      </ul>

      <h3>Main Props</h3>
      <table>
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>allowMultiple</code>
            </td>
            <td>boolean</td>
            <td>Allow multiple items to be open simultaneously</td>
          </tr>
          <tr>
            <td>
              <code>defaultValue</code>
            </td>
            <td>string[]</td>
            <td>Initially open items (uncontrolled)</td>
          </tr>
          <tr>
            <td>
              <code>value</code>
            </td>
            <td>string[]</td>
            <td>Open items (controlled)</td>
          </tr>
          <tr>
            <td>
              <code>onChange</code>
            </td>
            <td>function</td>
            <td>Callback when open items change</td>
          </tr>
          <tr>
            <td>
              <code>Item.value</code>
            </td>
            <td>string</td>
            <td>Unique identifier for the accordion item</td>
          </tr>
          <tr>
            <td>
              <code>Item.disabled</code>
            </td>
            <td>boolean</td>
            <td>Disable the accordion item</td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  ));
});
