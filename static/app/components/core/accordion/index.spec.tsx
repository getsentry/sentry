import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Accordion} from '.';

const ACCORDION_ITEMS = [
  {value: 'general', title: 'General Information', content: 'General content here'},
  {value: 'details', title: 'Details', content: 'Detailed information here'},
  {value: 'settings', title: 'Settings', content: 'Settings configuration here'},
];

function ControlledAccordion() {
  const [openItems, setOpenItems] = useState<string[]>(['general']);

  return (
    <Accordion value={openItems} onChange={setOpenItems} allowMultiple>
      {ACCORDION_ITEMS.map(item => (
        <Accordion.Item key={item.value} value={item.value}>
          <Accordion.Header>
            <Accordion.Trigger>{item.title}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{item.content}</Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

describe('Accordion', () => {
  it('renders accordion items', () => {
    render(
      <Accordion>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    // All triggers should be rendered
    ACCORDION_ITEMS.forEach(item => {
      expect(screen.getByRole('button', {name: item.title})).toBeInTheDocument();
    });

    // By default, no content should be visible
    ACCORDION_ITEMS.forEach(item => {
      expect(screen.queryByText(item.content)).not.toBeInTheDocument();
    });
  });

  it('opens accordion item on click', async () => {
    render(
      <Accordion>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    // Click on the first item
    await userEvent.click(screen.getByRole('button', {name: 'General Information'}));

    // First item content should be visible
    expect(screen.getByText('General content here')).toBeInTheDocument();

    // Button should have correct aria-expanded
    expect(screen.getByRole('button', {name: 'General Information'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('closes accordion item when clicking again (single mode)', async () => {
    render(
      <Accordion>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    const trigger = screen.getByRole('button', {name: 'General Information'});

    // Open the item
    await userEvent.click(trigger);
    expect(screen.getByText('General content here')).toBeInTheDocument();

    // Close the item
    await userEvent.click(trigger);
    expect(screen.queryByText('General content here')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens only one item at a time by default (single mode)', async () => {
    render(
      <Accordion>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    // Open first item
    await userEvent.click(screen.getByRole('button', {name: 'General Information'}));
    expect(screen.getByText('General content here')).toBeInTheDocument();

    // Open second item - should close first
    await userEvent.click(screen.getByRole('button', {name: 'Details'}));
    expect(screen.queryByText('General content here')).not.toBeInTheDocument();
    expect(screen.getByText('Detailed information here')).toBeInTheDocument();

    // Verify aria-expanded states
    expect(screen.getByRole('button', {name: 'General Information'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('button', {name: 'Details'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('allows multiple items open with allowMultiple prop', async () => {
    render(
      <Accordion allowMultiple>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    // Open first item
    await userEvent.click(screen.getByRole('button', {name: 'General Information'}));
    expect(screen.getByText('General content here')).toBeInTheDocument();

    // Open second item - first should remain open
    await userEvent.click(screen.getByRole('button', {name: 'Details'}));
    expect(screen.getByText('General content here')).toBeInTheDocument();
    expect(screen.getByText('Detailed information here')).toBeInTheDocument();

    // Both should have aria-expanded="true"
    expect(screen.getByRole('button', {name: 'General Information'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Details'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('opens default items with defaultValue prop', () => {
    render(
      <Accordion defaultValue={['general', 'details']} allowMultiple>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    // Default items should be open
    expect(screen.getByText('General content here')).toBeInTheDocument();
    expect(screen.getByText('Detailed information here')).toBeInTheDocument();
    expect(screen.queryByText('Settings configuration here')).not.toBeInTheDocument();

    // Buttons should have correct aria-expanded
    expect(screen.getByRole('button', {name: 'General Information'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Details'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', {name: 'Settings'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('works in controlled mode', async () => {
    render(<ControlledAccordion />);

    // Initial state: general should be open
    expect(screen.getByText('General content here')).toBeInTheDocument();
    expect(screen.queryByText('Detailed information here')).not.toBeInTheDocument();

    // Click on details
    await userEvent.click(screen.getByRole('button', {name: 'Details'}));

    // Both should be open (allowMultiple is true)
    expect(screen.getByText('General content here')).toBeInTheDocument();
    expect(screen.getByText('Detailed information here')).toBeInTheDocument();
  });

  it('calls onChange callback in controlled mode', async () => {
    const onChange = jest.fn();
    render(
      <Accordion value={['general']} onChange={onChange} allowMultiple>
        {ACCORDION_ITEMS.map(item => (
          <Accordion.Item key={item.value} value={item.value}>
            <Accordion.Header>
              <Accordion.Trigger>{item.title}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel>{item.content}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );

    // Click on details
    await userEvent.click(screen.getByRole('button', {name: 'Details'}));

    // onChange should be called with new open items
    expect(onChange).toHaveBeenCalledWith(['general', 'details']);
  });

  it('handles disabled accordion items', async () => {
    render(
      <Accordion>
        <Accordion.Item value="enabled">
          <Accordion.Header>
            <Accordion.Trigger>Enabled Item</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Enabled content</Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="disabled" disabled>
          <Accordion.Header>
            <Accordion.Trigger>Disabled Item</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Disabled content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );

    // Disabled item should not respond to clicks
    await userEvent.click(screen.getByRole('button', {name: 'Disabled Item'}));
    expect(screen.queryByText('Disabled content')).not.toBeInTheDocument();

    // Enabled item should work normally
    await userEvent.click(screen.getByRole('button', {name: 'Enabled Item'}));
    expect(screen.getByText('Enabled content')).toBeInTheDocument();
  });

  it('renders custom className', () => {
    render(
      <Accordion className="custom-accordion">
        <Accordion.Item value="test">
          <Accordion.Header>
            <Accordion.Trigger>Test</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );

    expect(document.querySelector('.custom-accordion')).toBeInTheDocument();
  });

  it('renders custom className on items', () => {
    render(
      <Accordion>
        <Accordion.Item value="test" className="custom-item">
          <Accordion.Header className="custom-header">
            <Accordion.Trigger className="custom-trigger">Test</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="custom-panel">Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );

    expect(document.querySelector('.custom-item')).toBeInTheDocument();
    expect(document.querySelector('.custom-header')).toBeInTheDocument();
    expect(document.querySelector('.custom-trigger')).toBeInTheDocument();
    expect(document.querySelector('.custom-panel')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', async () => {
    render(
      <Accordion>
        <Accordion.Item value="test">
          <Accordion.Header>
            <Accordion.Trigger>Test Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Test Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );

    const trigger = screen.getByRole('button', {name: 'Test Trigger'});

    // Should have proper ARIA attributes
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-labelledby');

    // Open the accordion to make the panel visible
    await userEvent.click(trigger);

    // Panel should now be visible and have matching ID
    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).toBeTruthy();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens accordion item when clicking on trigger content', async () => {
    render(
      <Accordion>
        <Accordion.Item value="test">
          <Accordion.Header>
            <Accordion.Trigger>
              <div data-testid="trigger-content">Complex Trigger Content</div>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Panel content</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    );

    // Click on the trigger content area (not just the button)
    await userEvent.click(screen.getByText('Complex Trigger Content'));

    // Panel should be open
    expect(screen.getByText('Panel content')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('throws error when Accordion components are used without proper context', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <Accordion.Item value="test">
          <Accordion.Header>
            <Accordion.Trigger>Test</Accordion.Trigger>
          </Accordion.Header>
        </Accordion.Item>
      );
    }).toThrow('Accordion components must be used within an Accordion');

    expect(() => {
      render(
        <Accordion>
          <Accordion.Header>
            <Accordion.Trigger>Test</Accordion.Trigger>
          </Accordion.Header>
        </Accordion>
      );
    }).toThrow('AccordionItem components must be used within an AccordionItem');

    consoleSpy.mockRestore();
  });
});
