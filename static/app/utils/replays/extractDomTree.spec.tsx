import {extractDomTree} from 'sentry/utils/replays/extractDomTree';

function createElement(
  tag: string,
  attrs: Record<string, string> = {},
  children: Array<HTMLElement | string> = []
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

// Helper to build a DOM tree with body > ... > target so ancestor path is testable
function buildWithAncestors(target: HTMLElement): HTMLElement {
  const body = document.createElement('body');
  const app = createElement('div', {id: 'app'});
  const main = createElement('main', {class: 'dashboard'});
  body.appendChild(app);
  app.appendChild(main);
  main.appendChild(target);
  return target;
}

describe('extractDomTree', () => {
  describe('small subtrees', () => {
    it('includes full HTML for elements with few descendants', () => {
      const el = createElement(
        'div',
        {class: 'error-card', 'data-sentry-component': 'ErrorCard'},
        [
          createElement('h3', {class: 'title'}, ['Something went wrong']),
          createElement('span', {class: 'timestamp'}, ['2 hours ago']),
        ]
      );

      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).toContain('error-card');
      expect(result).toContain('Something went wrong');
      expect(result).toContain('2 hours ago');
      expect(result).toContain('<!-- Ancestor path:');
      expect(result).toContain('<!-- CSS Selector:');
    });

    it('includes ancestor path from body', () => {
      const el = createElement('span', {}, ['hello']);
      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).toContain('body > div#app > main.dashboard');
    });
  });

  describe('CSS selector generation', () => {
    it('generates selector with data-sentry-component', () => {
      const el = createElement('div', {
        'data-sentry-component': 'ErrorCard',
        id: 'my-card',
      });
      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).toContain('CSS Selector:');
      expect(result).toContain('ErrorCard');
    });

    it('generates selector with tag and classes when no component name', () => {
      const el = createElement('div', {class: 'foo bar'});
      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).toContain('CSS Selector:');
      expect(result).toContain('div');
    });
  });

  describe('rrweb artifact cleanup', () => {
    it('removes data-rr-* attributes', () => {
      const el = createElement('div', {
        'data-rr-is-shadow-host': 'true',
        'data-rr-id': '42',
        class: 'real-class',
      });
      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).not.toContain('data-rr-is-shadow-host');
      expect(result).not.toContain('data-rr-id');
      expect(result).toContain('real-class');
    });

    it('removes rr- prefixed class names', () => {
      const el = createElement('div', {class: 'rr-block my-class rr_mirror'});
      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).toContain('my-class');
      expect(result).not.toMatch(/rr-block/);
      expect(result).not.toMatch(/rr_mirror/);
    });
  });

  describe('depth limiting for large subtrees', () => {
    it('truncates children beyond depth limit', () => {
      // Build a tree with > 50 elements to trigger depth limiting
      const children: HTMLElement[] = [];
      for (let i = 0; i < 20; i++) {
        children.push(
          createElement('div', {class: `item-${i}`}, [
            createElement('span', {}, ['text']),
            createElement('div', {}, [
              createElement('a', {}, [createElement('strong', {}, ['link'])]),
              createElement('em', {}, ['emphasis']),
            ]),
          ])
        );
      }
      const el = createElement('div', {class: 'large-container'}, children);
      buildWithAncestors(el);

      // depthLimit: 1 means children at depth 1 or deeper get truncated
      const result = extractDomTree(el, {depthLimit: 1});

      // Items have child elements, so they should get truncated
      expect(result).toContain('more children');
    });

    it('collapses style elements regardless of depth', () => {
      const el = createElement('div', {}, [
        createElement('style', {}, ['.foo { color: red; } .bar { color: blue; }']),
      ]);
      buildWithAncestors(el);
      const result = extractDomTree(el);

      expect(result).toContain('/* styles */');
      expect(result).not.toContain('color: red');
    });

    it('collapses SVG elements regardless of depth', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '10');
      circle.setAttribute('cy', '10');
      circle.setAttribute('r', '5');
      svg.appendChild(circle);

      const el = createElement('div', {});
      el.appendChild(svg);
      buildWithAncestors(el);

      const result = extractDomTree(el);

      expect(result).toContain('<!-- SVG -->');
      // Should not contain the circle's attributes
      expect(result).not.toContain('cx="10"');
    });
  });

  describe('token budget enforcement', () => {
    it('truncates output when exceeding character budget', () => {
      // Build a tree that will produce a large output
      const children: HTMLElement[] = [];
      for (let i = 0; i < 100; i++) {
        children.push(
          createElement('div', {class: `long-class-name-${i}-extra-padding-text`}, [
            createElement('span', {class: `nested-${i}`}, [
              `Long text content number ${i} that adds to the overall size of the output`,
            ]),
          ])
        );
      }
      const el = createElement('div', {class: 'container'}, children);
      buildWithAncestors(el);

      const result = extractDomTree(el, {charBudget: 500});

      expect(result.length).toBeLessThanOrEqual(500);
      // Should have a truncation marker
      expect(result).toContain('total elements');
    });

    it('stays within budget for small elements without truncation', () => {
      const el = createElement('div', {class: 'small'}, [
        createElement('span', {}, ['hello']),
      ]);
      buildWithAncestors(el);

      const result = extractDomTree(el, {charBudget: 8000});

      // Should not be truncated
      expect(result).not.toContain('Truncated');
      expect(result).toContain('hello');
    });
  });

  describe('element description in ancestor path', () => {
    it('includes data-sentry-component in ancestor descriptions', () => {
      const body = document.createElement('body');
      const wrapper = createElement('div', {'data-sentry-component': 'PageLayout'});
      const target = createElement('span', {}, ['target']);
      body.appendChild(wrapper);
      wrapper.appendChild(target);

      const result = extractDomTree(target);

      expect(result).toContain('data-sentry-component="PageLayout"');
    });

    it('skips very long class names in ancestor descriptions', () => {
      const body = document.createElement('body');
      const wrapper = createElement('div', {
        class:
          'short-cls a-very-long-hash-like-class-name-that-exceeds-forty-characters-in-length',
      });
      const target = createElement('span', {}, ['target']);
      body.appendChild(wrapper);
      wrapper.appendChild(target);

      const result = extractDomTree(target);

      // The short class should appear in ancestor path
      expect(result).toContain('short-cls');
    });
  });
});
