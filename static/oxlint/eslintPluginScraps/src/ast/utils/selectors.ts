import selectorParser from 'postcss-selector-parser';

export const COMPONENT_SELECTOR = 'sentry-interpolation';

type DomCouplingTarget = 'component' | 'element' | 'universal' | 'unscoped';

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
      const of = /\s+of\s+/i.exec(node.toString());
      if (!of) {
        return false;
      }
      const start = node.sourceIndex + of.index + of[0].length;
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
      const of = /\s+of\s+/i.exec(parent.toString());
      return !of || node.sourceIndex < parent.sourceIndex + of.index + of[0].length;
    }
    // :lang(en), :dir(rtl), and ::part(icon) take names, not selectors.
    if (!SELECTOR_PSEUDOS.has(parent.value)) {
      return true;
    }
  }
  return false;
}

/** Check selector syntax, including selectors nested inside :has/:is/:not. */
export function getDomCouplingTarget(selector: string): DomCouplingTarget | undefined {
  let root: selectorParser.Root;
  try {
    root = selectorParser().astSync(selector);
  } catch {
    // Incomplete or dynamic CSS must not prevent other rules from running.
    return undefined;
  }
  let target: DomCouplingTarget | undefined;
  let unscoped = false;
  root.walk(node => {
    if (isPseudoArgument(node)) {
      return;
    }
    if (node.type === 'tag') {
      target ??= node.value === COMPONENT_SELECTOR ? 'component' : 'element';
    } else if (node.type === 'universal') {
      target ??= 'universal';
    }
    if (node.type === 'combinator') {
      const subject: selectorParser.Node[] = [];
      for (
        let next = node.next();
        next && next.type !== 'combinator';
        next = next.next()
      ) {
        subject.push(next);
      }
      if (!isScoped(subject)) {
        unscoped = true;
      }
    }
  });
  return target ?? (unscoped ? 'unscoped' : undefined);
}
