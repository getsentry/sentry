import constructSelector from 'sentry/views/replays/selectors/constructSelector';

const MAX_CHAR_BUDGET = 8000;
const SMALL_SUBTREE_THRESHOLD = 50;
const DEFAULT_DEPTH_LIMIT = 3;

interface ExtractDomTreeOptions {
  /**
   * Maximum character budget for the output (~2 chars per token).
   */
  charBudget?: number;
  /**
   * Maximum depth for subtree serialization.
   * Only applies if the subtree exceeds SMALL_SUBTREE_THRESHOLD elements.
   */
  depthLimit?: number;
}

/**
 * Extracts a structured DOM tree representation from an element inside an rrweb replay iframe.
 * Designed to produce concise, LLM-friendly output for Seer Explore.
 *
 * The output includes:
 * - An ancestor path from <body> to the element's parent
 * - A CSS selector for the element
 * - The element's subtree HTML, depth-limited and cleaned of rrweb artifacts
 */
export function extractDomTree(
  element: HTMLElement,
  options: ExtractDomTreeOptions = {}
): string {
  const {charBudget = MAX_CHAR_BUDGET, depthLimit = DEFAULT_DEPTH_LIMIT} = options;

  const ancestorPath = buildAncestorPath(element);
  const selector = buildElementSelector(element);
  const subtreeSize = countDescendantElements(element);

  // Always serialize with depth limiting to ensure style/SVG cleanup.
  // For small subtrees, use a very high depth to preserve full structure.
  let html: string;
  const effectiveDepth = subtreeSize < SMALL_SUBTREE_THRESHOLD ? Infinity : depthLimit;
  html = serializeWithDepthLimit(element, effectiveDepth);

  // Clean rrweb artifacts from the HTML
  html = cleanRrwebArtifacts(html);

  // Assemble the output
  let output = '';
  if (ancestorPath) {
    output += `<!-- Ancestor path: ${ancestorPath} -->\n`;
  }
  if (selector) {
    output += `<!-- CSS Selector: ${selector} -->\n`;
  }
  output += html;

  // Enforce token budget — progressively reduce depth if too large
  if (output.length > charBudget) {
    for (let depth = depthLimit - 1; depth >= 1; depth--) {
      html = cleanRrwebArtifacts(serializeWithDepthLimit(element, depth));
      output = '';
      if (ancestorPath) {
        output += `<!-- Ancestor path: ${ancestorPath} -->\n`;
      }
      if (selector) {
        output += `<!-- CSS Selector: ${selector} -->\n`;
      }
      output += html;

      if (output.length <= charBudget) {
        break;
      }
    }

    // If still too large after depth=1, hard truncate
    if (output.length > charBudget) {
      output =
        output.substring(0, charBudget - 50) +
        `\n<!-- Truncated: ${subtreeSize} total elements -->`;
    }
  }

  return output;
}

/**
 * Builds a human-readable ancestor path from <body> down to the element's parent.
 * Example: "body > div#app > main.dashboard > section.error-list"
 */
function buildAncestorPath(element: HTMLElement): string {
  const ancestors: string[] = [];
  let current = element.parentElement;

  while (current && current.tagName !== 'HTML') {
    ancestors.unshift(describeElement(current));
    current = current.parentElement;
  }

  return ancestors.join(' > ');
}

/**
 * Produces a short descriptor for an element: tag + id + key classes + data-sentry-component.
 */
function describeElement(el: HTMLElement): string {
  let desc = el.tagName.toLowerCase();

  if (el.id) {
    desc += `#${el.id}`;
  }

  const classes = getSignificantClasses(el);
  if (classes.length > 0) {
    desc += `.${classes.join('.')}`;
  }

  const sentryComponent = el.getAttribute('data-sentry-component');
  if (sentryComponent) {
    desc += `[data-sentry-component="${sentryComponent}"]`;
  }

  return desc;
}

/**
 * Gets the first few non-rrweb, non-generated class names from an element.
 */
function getSignificantClasses(el: HTMLElement, max = 2): string[] {
  const classes: string[] = [];
  for (const cls of el.classList) {
    // Skip rrweb-injected and very long/hash-like class names
    if (cls.startsWith('rr-') || cls.startsWith('rr_') || cls.length > 40) {
      continue;
    }
    classes.push(cls);
    if (classes.length >= max) {
      break;
    }
  }
  return classes;
}

/**
 * Builds a CSS selector for the element using the same constructSelector utility
 * used elsewhere in the replay system.
 */
function buildElementSelector(element: HTMLElement): string {
  const classes = (element.getAttribute('class')?.split(' ') ?? []).filter(
    cls => cls && !cls.startsWith('rr-') && !cls.startsWith('rr_')
  );
  return constructSelector({
    alt: element.getAttribute('alt') ?? '',
    aria_label: element.getAttribute('aria-label') ?? '',
    class: classes,
    component_name: element.getAttribute('data-sentry-component') ?? '',
    id: element.id,
    role: element.getAttribute('role') ?? '',
    tag: element.tagName.toLowerCase(),
    testid: element.getAttribute('data-test-id') ?? '',
    title: element.getAttribute('title') ?? '',
  }).selector;
}

/**
 * Counts all descendant elements (not text nodes) of an element.
 */
function countDescendantElements(element: HTMLElement): number {
  return element.querySelectorAll('*').length;
}

/**
 * Serializes an element's outerHTML with a depth limit.
 * Children beyond the depth limit are replaced with placeholder comments.
 */
function serializeWithDepthLimit(element: HTMLElement, maxDepth: number): string {
  // Clone so we don't mutate the replay DOM
  const clone = element.cloneNode(true) as HTMLElement;
  truncateAtDepth(clone, maxDepth, 0);
  return clone.outerHTML;
}

function truncateAtDepth(el: HTMLElement, maxDepth: number, currentDepth: number) {
  for (const child of Array.from(el.children)) {
    const htmlChild = child as HTMLElement;

    // Always collapse style and SVG content regardless of depth
    if (child.tagName === 'STYLE') {
      child.textContent = '/* styles */';
      continue;
    }
    if (child.tagName.toLowerCase() === 'svg') {
      child.innerHTML = '<!-- SVG -->';
      continue;
    }

    if (currentDepth >= maxDepth) {
      if (child.childElementCount > 0) {
        child.innerHTML = `<!-- ${child.childElementCount} more children -->`;
      }
    } else {
      truncateAtDepth(htmlChild, maxDepth, currentDepth + 1);
    }
  }
}

/**
 * Cleans rrweb-specific artifacts from serialized HTML that would confuse an LLM.
 * - Removes data-rr-* attributes
 * - Removes rr-block class references
 */
function cleanRrwebArtifacts(html: string): string {
  // Remove data-rr-* attributes (e.g. data-rr-is-shadow-host, data-rr-id)
  let cleaned = html.replace(/\s+data-rr-[a-z-]+="[^"]*"/g, '');
  // Remove rr_ prefixed class names from class attributes
  cleaned = cleaned.replace(/class="([^"]*)"/g, (_match, classes: string) => {
    const filtered = classes
      .split(' ')
      .filter((cls: string) => !cls.startsWith('rr-') && !cls.startsWith('rr_'))
      .join(' ')
      .trim();
    return filtered ? `class="${filtered}"` : '';
  });
  // Clean up any leftover empty class attributes
  cleaned = cleaned.replace(/\s+class=""\s*/g, ' ');
  return cleaned;
}
