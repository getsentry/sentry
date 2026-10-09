import {createFlamegraph, parseFlamegraphAttachment, treeToSamples} from './utils';

const diagnostic = {
  version: '1',
  platform: 'cocoa',
  frames: [
    {function: 'main', instruction_addr: '0x1000', in_app: true},
    {function: 'process', filename: 'Processor.swift', lineno: 42},
  ],
  trees: [
    {
      roots: [
        {frame_id: 0, sample_count: 10, children: [{frame_id: 1, sample_count: 6}]},
      ],
    },
  ],
};

describe('Flamegraph attachments', () => {
  it('parses downloaded JSON strings and objects', () => {
    expect(parseFlamegraphAttachment(diagnostic)).toEqual(diagnostic);
    expect(parseFlamegraphAttachment(JSON.stringify(diagnostic))).toEqual(diagnostic);
  });

  it('emits weighted paths including samples ending at a parent', () => {
    const data = parseFlamegraphAttachment(diagnostic);
    expect(treeToSamples(data.trees[0]!)).toEqual({
      samples: [[0], [0, 1]],
      weights: [4, 6],
    });
  });

  it('preserves repeated and recursive occurrences of a shared frame', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      trees: [
        {
          roots: [
            {frame_id: 0, sample_count: 6, children: [{frame_id: 0, sample_count: 4}]},
            {frame_id: 0, sample_count: 4},
          ],
        },
      ],
    });
    expect(treeToSamples(data.trees[0]!)).toEqual({
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

  it('keeps each tree as an independent sample population', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      trees: [
        ...diagnostic.trees,
        {thread_id: '7', roots: [{frame_id: 1, sample_count: 3}]},
      ],
    });
    expect(createFlamegraph(data, 0).configSpace.width).toBe(10);
    expect(createFlamegraph(data, 1).configSpace.width).toBe(3);
  });

  it('uses captured addresses for unresolved frame names', () => {
    const data = parseFlamegraphAttachment({
      ...diagnostic,
      frames: [{function: '', instruction_addr: '0x1000'}, {filename: 'Processor.swift'}],
    });
    expect(createFlamegraph(data, 0).root.children[0]?.frame.name).toBe('0x1000');
  });

  it.each([
    'not JSON',
    null,
    {...diagnostic, version: '2'},
    {...diagnostic, frames: []},
    {...diagnostic, trees: []},
    {...diagnostic, frames: [{function: 1}]},
    {...diagnostic, trees: [{roots: [{frame_id: 0, sample_count: 1, children: null}]}]},
    {...diagnostic, trees: [{roots: [{frame_id: 2, sample_count: 1}]}]},
    {...diagnostic, trees: [{roots: [{frame_id: true, sample_count: 1}]}]},
    {...diagnostic, trees: [{roots: [{frame_id: 0, sample_count: 0}]}]},
    {...diagnostic, trees: [{roots: [{frame_id: 0, sample_count: 9007199254740992}]}]},
    {
      ...diagnostic,
      trees: [
        {
          roots: [
            {frame_id: 0, sample_count: 1, children: [{frame_id: 1, sample_count: 2}]},
          ],
        },
      ],
    },
  ])('rejects malformed or unsupported data: %j', value => {
    expect(() => parseFlamegraphAttachment(value)).toThrow();
  });
});
