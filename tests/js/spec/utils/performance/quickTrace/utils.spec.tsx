import {Event} from 'app/types/event';
import {TraceFull} from 'app/utils/performance/quickTrace/types';
import {
  flattenRelevantPaths,
  parseQuickTrace,
} from 'app/utils/performance/quickTrace/utils';

type Position = {
  generation: number;
  offset: number;
};

function hexCharFor(x: number): string {
  x = x % 16;
  if (x < 10) {
    return String(x);
  }
  return String.fromCharCode('a'.charCodeAt(0) + x - 10);
}

function generateId(prefix: string, {generation, offset}: Position) {
  const s = `${hexCharFor(generation)}${hexCharFor(offset)}`;
  return `${prefix}:${Array(7).join(s)}`;
}

function generateEventId({generation, offset}: Position) {
  return generateId('e', {generation, offset});
}

function generateSpanId({generation, offset}: Position) {
  return generateId('s', {generation, offset});
}

function generateTransactionName({generation, offset}: Position) {
  return `transaction-${generation}-${offset}`;
}

function generateProjectSlug({generation, offset}: Position) {
  const c = hexCharFor(generation);
  return `project-${c.toUpperCase()}-${offset}`;
}

function computePosition(index: number) {
  index += 1;
  const generation = Math.floor(Math.log2(index));
  const offset = index - 2 ** generation;
  return {generation, offset};
}

function generateTransactionLite({
  generation,
  offset,
}: {
  generation: number;
  offset: number;
}) {
  const position = {generation, offset};
  const parentPosition = {
    generation: generation - 1,
    offset: Math.floor(offset / 2),
  };

  return {
    event_id: generateEventId(position),
    generation,
    span_id: generateSpanId(position),
    transaction: generateTransactionName(position),
    'transaction.duration': 0,
    project_id: generation, // just use generation as project id
    project_slug: generateProjectSlug(position),
    parent_event_id: generation <= 0 ? null : generateEventId(parentPosition),
    parent_span_id: generation <= 0 ? null : generateSpanId(parentPosition),
    errors: [],
  };
}

function generateTransaction(opts: {index: number; depth: number}): TraceFull {
  const {index, depth = -1} = opts;
  const {generation, offset} = computePosition(index);

  return {
    ...generateTransactionLite({generation, offset}),
    errors: [],
    children: Array(depth <= 0 || generation >= depth - 1 ? 0 : 2)
      .fill(null)
      .map((_, i) =>
        generateTransaction({
          index: 2 * index + i + 1,
          depth,
        })
      ),
    /**
     * These timestamps aren't used in tests here, just adding them to pass
     * the type checking.
     */
    'transaction.duration': 0,
  };
}

function generateTrace(depth = 1): TraceFull {
  if (depth < 1) {
    throw new Error('Minimum depth is 1!');
  }
  return generateTransaction({
    depth,
    index: 0,
  });
}

function generateEventSelector(position: Position, eventType: string): Event {
  return {id: generateEventId(position), type: eventType} as Event;
}

describe('Quick Trace Utils', function () {
  describe('flattenRelevantPaths', function () {
    it('flattens trace without the expected event', function () {
      const trace = generateTrace(1);
      const current = {id: 'you cant find me'} as Event;
      expect(() => flattenRelevantPaths(current, trace)).toThrow(
        'No relevant path exists!'
      );
    });

    it('flattens a single transaction trace', function () {
      const trace = generateTrace(1);
      const current = generateEventSelector({generation: 0, offset: 0}, 'transaction');
      const relevantPath = flattenRelevantPaths(current, trace);
      expect(relevantPath).toMatchObject([
        generateTransactionLite({generation: 0, offset: 0}),
      ]);
    });

    it('flattens trace from the leaf', function () {
      const trace = generateTrace(3);
      const current = generateEventSelector({generation: 2, offset: 3}, 'transaction');
      const relevantPath = flattenRelevantPaths(current, trace);
      expect(relevantPath).toMatchObject([
        generateTransactionLite({generation: 0, offset: 0}),
        generateTransactionLite({generation: 1, offset: 1}),
        generateTransactionLite({generation: 2, offset: 3}),
      ]);
    });

    it('flattens trace from the middle', function () {
      const trace = generateTrace(3);
      const current = generateEventSelector({generation: 1, offset: 1}, 'transaction');
      const relevantPath = flattenRelevantPaths(current, trace);
      expect(relevantPath).toMatchObject([
        generateTransactionLite({generation: 0, offset: 0}),
        generateTransactionLite({generation: 1, offset: 1}),
        generateTransactionLite({generation: 2, offset: 2}),
        generateTransactionLite({generation: 2, offset: 3}),
      ]);
    });

    it('flattens trace from the root', function () {
      const trace = generateTrace(3);
      const current = generateEventSelector({generation: 0, offset: 0}, 'transaction');
      const relevantPath = flattenRelevantPaths(current, trace);
      expect(relevantPath).toMatchObject([
        generateTransactionLite({generation: 0, offset: 0}),
        generateTransactionLite({generation: 1, offset: 0}),
        generateTransactionLite({generation: 1, offset: 1}),
        generateTransactionLite({generation: 2, offset: 0}),
        generateTransactionLite({generation: 2, offset: 1}),
        generateTransactionLite({generation: 2, offset: 2}),
        generateTransactionLite({generation: 2, offset: 3}),
      ]);
    });
  });

  describe('parseQuickTrace', function () {
    it('parses empty trace', function () {
      const current = generateEventSelector({generation: 0, offset: 0}, 'transaction');
      expect(() => parseQuickTrace({type: 'empty', trace: []}, current)).toThrow(
        'Current event not in quick trace'
      );
    });

    describe('partial trace', function () {
      it('parses correctly without the expected event', function () {
        const relevantPath = [generateTransactionLite({generation: 0, offset: 0})];
        const current = generateEventSelector({generation: 1, offset: 0}, 'transaction');
        expect(() =>
          parseQuickTrace({type: 'partial', trace: relevantPath}, current)
        ).toThrow('Current event not in quick trace');
      });

      it('parses only the current event', function () {
        const relevantPath = [generateTransactionLite({generation: 0, offset: 0})];
        const current = generateEventSelector({generation: 0, offset: 0}, 'transaction');
        const parsedQuickTrace = parseQuickTrace(
          {type: 'partial', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toEqual({
          root: null,
          ancestors: null,
          parent: null,
          current: generateTransactionLite({generation: 0, offset: 0}),
          children: [],
          descendants: null,
        });
      });

      it('parses current with only parent', function () {
        const relevantPath = [
          generateTransactionLite({generation: 0, offset: 0}),
          generateTransactionLite({generation: 1, offset: 0}),
        ];
        const current = generateEventSelector({generation: 1, offset: 0}, 'transaction');
        const parsedQuickTrace = parseQuickTrace(
          {type: 'partial', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toEqual({
          root: null,
          ancestors: null,
          parent: generateTransactionLite({generation: 0, offset: 0}),
          current: generateTransactionLite({generation: 1, offset: 0}),
          children: [],
          descendants: null,
        });
      });

      it('parses current with only root', function () {
        const relevantPath = [
          generateTransactionLite({generation: 0, offset: 0}),
          generateTransactionLite({generation: 2, offset: 0}),
        ];
        const current = generateEventSelector({generation: 2, offset: 0}, 'transaction');
        const parsedQuickTrace = parseQuickTrace(
          {type: 'partial', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toEqual({
          root: generateTransactionLite({generation: 0, offset: 0}),
          ancestors: null,
          parent: null,
          current: generateTransactionLite({generation: 2, offset: 0}),
          children: [],
          descendants: null,
        });
      });

      it('parses current with only children', function () {
        const relevantPath = [
          generateTransactionLite({generation: 0, offset: 0}),
          generateTransactionLite({generation: 1, offset: 0}),
          generateTransactionLite({generation: 1, offset: 1}),
        ];
        const current = generateEventSelector({generation: 0, offset: 0}, 'transaction');
        const parsedQuickTrace = parseQuickTrace(
          {type: 'partial', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toEqual({
          root: null,
          ancestors: null,
          parent: null,
          current: generateTransactionLite({generation: 0, offset: 0}),
          children: [
            generateTransactionLite({generation: 1, offset: 0}),
            generateTransactionLite({generation: 1, offset: 1}),
          ],
          descendants: null,
        });
      });

      it('parses current with parent and children', function () {
        const relevantPath = [
          generateTransactionLite({generation: 0, offset: 0}),
          generateTransactionLite({generation: 1, offset: 1}),
          generateTransactionLite({generation: 2, offset: 2}),
        ];
        const current = generateEventSelector({generation: 1, offset: 1}, 'transaction');
        const parsedQuickTrace = parseQuickTrace(
          {type: 'partial', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toEqual({
          root: null,
          ancestors: null,
          parent: generateTransactionLite({generation: 0, offset: 0}),
          current: generateTransactionLite({generation: 1, offset: 1}),
          children: [generateTransactionLite({generation: 2, offset: 2})],
          descendants: null,
        });
      });

      it('parses current with root and children', function () {
        const relevantPath = [
          generateTransactionLite({generation: 0, offset: 0}),
          generateTransactionLite({generation: 2, offset: 2}),
          generateTransactionLite({generation: 3, offset: 4}),
          generateTransactionLite({generation: 3, offset: 5}),
        ];
        const current = generateEventSelector({generation: 2, offset: 2}, 'transaction');
        const parsedQuickTrace = parseQuickTrace(
          {type: 'partial', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toEqual({
          root: generateTransactionLite({generation: 0, offset: 0}),
          ancestors: null,
          parent: null,
          current: generateTransactionLite({generation: 2, offset: 2}),
          children: [
            generateTransactionLite({generation: 3, offset: 4}),
            generateTransactionLite({generation: 3, offset: 5}),
          ],
          descendants: null,
        });
      });
    });

    describe('full trace', function () {
      it('parses the full trace', function () {
        const trace = generateTrace(6);
        const current = generateEventSelector({generation: 3, offset: 0}, 'transaction');
        const relevantPath = flattenRelevantPaths(current, trace);
        const parsedQuickTrace = parseQuickTrace(
          {type: 'full', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toMatchObject({
          root: generateTransactionLite({generation: 0, offset: 0}),
          ancestors: [generateTransactionLite({generation: 1, offset: 0})],
          parent: generateTransactionLite({generation: 2, offset: 0}),
          current: generateTransactionLite({generation: 3, offset: 0}),
          children: [
            generateTransactionLite({generation: 4, offset: 0}),
            generateTransactionLite({generation: 4, offset: 1}),
          ],
          descendants: [
            generateTransactionLite({generation: 5, offset: 0}),
            generateTransactionLite({generation: 5, offset: 1}),
            generateTransactionLite({generation: 5, offset: 2}),
            generateTransactionLite({generation: 5, offset: 3}),
          ],
        });
      });

      it('parses full trace without ancestors', function () {
        const trace = generateTrace(5);
        const current = generateEventSelector({generation: 2, offset: 0}, 'transaction');
        const relevantPath = flattenRelevantPaths(current, trace);
        const parsedQuickTrace = parseQuickTrace(
          {type: 'full', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toMatchObject({
          root: generateTransactionLite({generation: 0, offset: 0}),
          ancestors: [],
          parent: generateTransactionLite({generation: 1, offset: 0}),
          current: generateTransactionLite({generation: 2, offset: 0}),
          children: [
            generateTransactionLite({generation: 3, offset: 0}),
            generateTransactionLite({generation: 3, offset: 1}),
          ],
          descendants: [
            generateTransactionLite({generation: 4, offset: 0}),
            generateTransactionLite({generation: 4, offset: 1}),
            generateTransactionLite({generation: 4, offset: 2}),
            generateTransactionLite({generation: 4, offset: 3}),
          ],
        });
      });

      it('parses full trace without descendants', function () {
        const trace = generateTrace(5);
        const current = generateEventSelector({generation: 3, offset: 0}, 'transaction');
        const relevantPath = flattenRelevantPaths(current, trace);
        const parsedQuickTrace = parseQuickTrace(
          {type: 'full', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toMatchObject({
          root: generateTransactionLite({generation: 0, offset: 0}),
          ancestors: [generateTransactionLite({generation: 1, offset: 0})],
          parent: generateTransactionLite({generation: 2, offset: 0}),
          current: generateTransactionLite({generation: 3, offset: 0}),
          children: [
            generateTransactionLite({generation: 4, offset: 0}),
            generateTransactionLite({generation: 4, offset: 1}),
          ],
          descendants: [],
        });
      });

      it('parses full trace without children descendants', function () {
        const trace = generateTrace(4);
        const current = generateEventSelector({generation: 3, offset: 0}, 'transaction');
        const relevantPath = flattenRelevantPaths(current, trace);
        const parsedQuickTrace = parseQuickTrace(
          {type: 'full', trace: relevantPath},
          current
        );
        expect(parsedQuickTrace).toMatchObject({
          root: generateTransactionLite({generation: 0, offset: 0}),
          ancestors: [generateTransactionLite({generation: 1, offset: 0})],
          parent: generateTransactionLite({generation: 2, offset: 0}),
          current: generateTransactionLite({generation: 3, offset: 0}),
          children: [],
          descendants: [],
        });
      });
    });
  });
});
