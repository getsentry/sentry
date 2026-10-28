import {createFlamegraph, parseFlamegraphAttachment, treeToSamples} from './utils';

const diagnostic = {
  version: '1',
  platform: 'cocoa',
  frames: [
    {function: 'main', instruction_addr: '0x1000', in_app: true},
    {function: 'process', filename: 'Processor.swift', lineno: 42},
  ],
  nodes: [
    {frame_id: 0, sample_count: 10, children: [1]},
    {frame_id: 1, sample_count: 6},
  ],
  trees: [{roots: [0]}],
};

describe('Flamegraph attachments', () => {
  it('parses downloaded JSON strings and objects', () => {
    expect(parseFlamegraphAttachment(diagnostic)).toEqual(diagnostic);
    expect(parseFlamegraphAttachment(JSON.stringify(diagnostic))).toEqual(diagnostic);
  });

  it('emits weighted paths including samples ending at a parent', () => {
    const data = parseFlamegraphAttachment(diagnostic);
    expect(treeToSamples(data, data.trees[0]!)).toEqual({
      samples: [[0], [0, 1]],
      weights: [4, 6],
    });
  });

  it('preserves repeated and recursive occurrences of a shared frame', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      nodes: [
        {frame_id: 0, sample_count: 6, children: [1]},
        {frame_id: 0, sample_count: 4},
        {frame_id: 0, sample_count: 4},
      ],
      trees: [{roots: [0, 2]}],
    });
    expect(treeToSamples(data, data.trees[0]!)).toEqual({
      samples: [[0], [0, 0], [0]],
      weights: [2, 4, 4],
    });
  });

  it('builds a count-based model with source locations', () => {
    const model = createFlamegraph(parseFlamegraphAttachment(diagnostic), 0);
    expect(model.unit).toBe('count');
    expect(model.configSpace.width).toBe(10);
    expect(model.root.children[0]?.frame.name).toBe('main');
    expect(model.root.children[0]?.children[0]?.frame.file).toBe('Processor.swift');
    expect(model.root.children[0]?.children[0]?.frame.line).toBe(42);
  });

  it.each([undefined, false, true])('preserves frame classification: %s', inApp => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      frames: [{function: 'main', in_app: inApp}, diagnostic.frames[1]],
    });
    expect(createFlamegraph(data, 0).root.children[0]?.frame.is_application).toBe(
      inApp ?? false
    );
  });

  it('keeps distinct frame IDs with matching source locations separate', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      frames: [
        {function: 'main', in_app: true},
        {function: 'main', in_app: false},
      ],
    });
    const root = createFlamegraph(data, 0).root.children[0]!;
    expect(root.frame.is_application).toBe(true);
    expect(root.children[0]?.frame.is_application).toBe(false);
  });

  it('keeps each tree as an independent sample population', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      nodes: [...diagnostic.nodes, {frame_id: 1, sample_count: 3}],
      trees: [...diagnostic.trees, {thread_id: '7', roots: [2]}],
    });
    expect(createFlamegraph(data, 0).configSpace.width).toBe(10);
    expect(createFlamegraph(data, 1).configSpace.width).toBe(3);
  });

  it('resolves node IDs independently of frame IDs and array order', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      nodes: [
        {frame_id: 1, sample_count: 6},
        {frame_id: 0, sample_count: 10, children: [0]},
      ],
      trees: [{roots: [1]}],
    });
    expect(treeToSamples(data, data.trees[0]!)).toEqual({
      samples: [[0], [0, 1]],
      weights: [4, 6],
    });
  });

  it('uses captured addresses for unresolved frame names', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      frames: [{function: '', instruction_addr: '0x1000'}, {filename: 'Processor.swift'}],
      debug_meta: {images: []},
    });
    expect(createFlamegraph(data, 0).root.children[0]?.frame.name).toBe('0x1000');
  });

  it.each([
    'not JSON',
    null,
    {...diagnostic, version: '2'},
    {...diagnostic, frames: []},
    {...diagnostic, trees: []},
    {...diagnostic, nodes: []},
    {...diagnostic, frames: [{function: 1}]},
    {...diagnostic, nodes: [{frame_id: 0, sample_count: 1, children: null}]},
    {...diagnostic, nodes: [{frame_id: 2, sample_count: 1}]},
    {...diagnostic, nodes: [{frame_id: true, sample_count: 1}]},
    {...diagnostic, nodes: [{frame_id: 0, sample_count: 0}]},
    {...diagnostic, nodes: [{frame_id: 0, sample_count: 9007199254740992}]},
    {...diagnostic, trees: [{roots: [2]}]},
    {...diagnostic, trees: [{roots: [-1]}]},
    {...diagnostic, trees: [{roots: [{frame_id: 0, sample_count: 1}]}]},
    {...diagnostic, nodes: [{frame_id: 0, sample_count: 1, children: [1]}]},
    {...diagnostic, nodes: [{frame_id: 0, sample_count: 1, children: [0]}]},
    {
      ...diagnostic,
      nodes: [
        {frame_id: 0, sample_count: 1, children: [1]},
        {frame_id: 1, sample_count: 1, children: [0]},
      ],
    },
    {
      ...diagnostic,
      nodes: [
        {frame_id: 0, sample_count: 1, children: [1]},
        {frame_id: 1, sample_count: 2},
      ],
    },
  ])('rejects malformed or unsupported data: %j', value => {
    expect(() => parseFlamegraphAttachment(value)).toThrow();
  });
});
