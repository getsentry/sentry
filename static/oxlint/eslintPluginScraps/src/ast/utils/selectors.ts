import selectorParser from 'postcss-selector-parser';

const SELECTOR_PSEUDOS = new Set([
  ':has',
  ':host',
  ':host-context',
  ':is',
  ':matches',
  ':not',
  ':where',
  '::slotted',
]);

function getOfSelectorStart(pseudo: selectorParser.Container) {
  const of = /\s+of\s+/i.exec(pseudo.toString());
  return of ? pseudo.sourceIndex + of.index + of[0].length : undefined;
}

/** A selector is scoped when its subject has an explicit class, ID, or attribute. */
function isScoped(nodes: readonly selectorParser.Node[]): boolean {
  // Only the final compound selects the subject; earlier compounds select ancestors.
  nodes = nodes.slice(nodes.findLastIndex(node => node.type === 'combinator') + 1);
  return nodes.some(node => {
    if (
      node.type === 'class' ||
      node.type === 'id' ||
      node.type === 'attribute' ||
      node.type === 'nesting'
    ) {
      return true;
    }
    if (node.type !== 'pseudo') {
      return false;
    }
    const alternatives = node.nodes;
    if (/^:nth-(?:last-)?child$/.test(node.value)) {
      const start = getOfSelectorStart(node);
      if (start === undefined) {
        return false;
      }
      // Reuse the parsed arguments. Re-parsing a slice can throw for incomplete CSS.
      return (
        alternatives.length > 0 &&
        alternatives.every(selector =>
          isScoped(selector.nodes.filter(argument => argument.sourceIndex >= start))
        )
      );
    }
    if (node.value !== ':is' && node.value !== ':where') {
      return false;
    }
    return (
      alternatives.length > 0 && alternatives.every(selector => isScoped(selector.nodes))
    );
  });
}

function isPseudoArgument(node: selectorParser.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type !== 'pseudo') {
      continue;
    }
    if (/^:nth-(?:last-)?(?:child|of-type)$/.test(parent.value)) {
      // Formula tokens such as `2n + 1` are not element selectors. Selectors
      // after `of` still need checking: :nth-child(2n of button).
      const start = getOfSelectorStart(parent);
      return start === undefined || node.sourceIndex < start;
    }
    // :lang(en), :dir(rtl), and ::part(icon) take names, not selectors.
    if (!SELECTOR_PSEUDOS.has(parent.value)) {
      return true;
    }
  }
  return false;
}

function isForbidden(node: selectorParser.Node) {
  if (node.type === 'tag' || node.type === 'universal') {
    return true;
  }
  if (node.type !== 'combinator' || node.value.trim() !== '>') {
    return false;
  }
  const subject: selectorParser.Node[] = [];
  for (let next = node.next(); next && next.type !== 'combinator'; next = next.next()) {
    subject.push(next);
  }
  return !isScoped(subject);
}

/** Check selector syntax, including selectors nested inside :has/:is/:not. */
export function hasDomCoupling(selector: string): boolean {
  let root: selectorParser.Root;
  try {
    root = selectorParser().astSync(selector);
  } catch {
    // Incomplete or dynamic CSS must not prevent other rules from running.
    return false;
  }
  let forbidden = false;
  root.walk(node => {
    forbidden = !isPseudoArgument(node) && isForbidden(node);
    return !forbidden;
  });
  return forbidden;
}
