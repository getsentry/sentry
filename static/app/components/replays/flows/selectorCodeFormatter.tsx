import kebabCase from 'lodash/kebabCase';

import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

/**
 * Formats a CSS selector parts object into React elements that display it as formatted code
 * with syntax highlighting for different parts of the selector, showing it as an HTML element
 */
export function formatSelectorAsCode(
  selector: Omit<DeadRageSelectorItem['dom_element'], 'projectId'>
): React.ReactElement {
  if (!selector?.parts) {
    return <Text monospace>''</Text>;
  }

  const {parts} = selector;
  const attributes: Array<{
    key: string;
    type:
      | 'class'
      | 'id'
      | 'role'
      | 'testId'
      | 'title'
      | 'alt'
      | 'ariaLabel'
      | 'componentName';
    value: string;
  }> = [];

  // Add classes if they exist
  if (parts.classes && parts.classes.length > 0) {
    attributes.push({
      key: 'class',
      value: Array.isArray(parts.classes) ? parts.classes.join(' ') : parts.classes,
      type: 'class',
    });
  }

  // Add other attributes if they have values
  if (parts.id) {
    attributes.push({key: 'id', value: parts.id, type: 'id'});
  }
  if (parts.role) {
    attributes.push({key: 'role', value: parts.role, type: 'role'});
  }
  if (parts.testId) {
    attributes.push({key: 'data-test-id', value: parts.testId, type: 'testId'});
  }
  if (parts.title) {
    attributes.push({key: 'title', value: parts.title, type: 'title'});
  }
  if (parts.alt) {
    attributes.push({key: 'alt', value: parts.alt, type: 'alt'});
  }
  if (parts.ariaLabel) {
    attributes.push({key: 'aria-label', value: parts.ariaLabel, type: 'ariaLabel'});
  }
  if (parts.componentName) {
    attributes.push({
      key: 'data-sentry-component',
      value: parts.componentName,
      type: 'componentName',
    });
  }

  return (
    <Flex align="center">
      <Text monospace size="sm" variant="muted">
        &lt;
      </Text>
      <Flex gap="xs" align="center">
        <Text monospace variant="accent">
          {parts.tag}
        </Text>
        {attributes.map((attr, index) => {
          return (
            <Attribute
              key={`${index}-${attr.type}-${attr.key}`}
              name={attr.type}
              value={attr.value}
            />
          );
        })}
      </Flex>
      <Text monospace size="sm" variant="muted">
        &gt;
      </Text>
    </Flex>
  );
}

function Attribute({name, value}: {name: string; value: string}) {
  return (
    <Flex>
      <Text monospace size="sm" variant="muted">
        {' '}
      </Text>
      <Text monospace size="sm" variant="warning" wrap="nowrap">
        {kebabCase(name)}
      </Text>
      <Text monospace size="sm" variant="muted">
        ="
      </Text>
      <Text monospace size="sm" variant="success" wrap="nowrap">
        {value}
      </Text>
      <Text monospace size="sm" variant="muted">
        "
      </Text>
    </Flex>
  );
}
