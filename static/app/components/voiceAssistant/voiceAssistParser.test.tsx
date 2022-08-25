import {FuzzyCommand, HierarchicalCommand} from './voiceAssistParser';

describe.each(['navigate to options', 'go to options', 'please go to options'])(
  'match fuzzy command for %s',
  transcript => {
    test('should match', () => {
      const cmd = new FuzzyCommand('navigate', ['navigate', 'go'], ['options']);
      const match = cmd.match({transcript, confidence: 0.9});
      expect(match).not.toBeNull();
    });
    test('should not match unknown verbs', () => {
      const cmd = new FuzzyCommand('navigate', ['explore'], ['options']);
      const match = cmd.match({transcript, confidence: 0.9});
      expect(match).toBeNull();
    });
    test('should not match unknown attributes', () => {
      const cmd = new FuzzyCommand('navigate', ['explore'], ['projects']);
      const match = cmd.match({transcript, confidence: 0.9});
      expect(match).toBeNull();
    });
  }
);

test('FuzzyCommand rule', () => {
  const cmd = new FuzzyCommand('navigate', ['navigate', 'go'], ['options', 'settings']);
  expect(cmd.jsgfRule()).toEqual(
    '<navigate_verbs> = navigate | go;\n<navigate_attributes> = options | settings;\npublic <navigate> = <navigate_verbs> <navigate_attributes>$\n'
  );
});

describe.each([
  {transcript: 'navigate to issues', args: ['navigate', 'issues']},
  {transcript: 'go to issue details', args: ['go', 'issue', 'details']},
  {transcript: 'go to issues details page', args: ['go', 'issues', 'details', 'page']},
])('match hierarchical command for %s', ({transcript, args}) => {
  test('should match', () => {
    const cmd = new HierarchicalCommand(
      'navigate_issues',
      ['navigate', 'go'],
      ['issue', 'issues'],
      ['details', 'detail'],
      ['page', 'pages']
    );
    const match = cmd.match({transcript, confidence: 0.9});
    expect(match).not.toBeNull();
    expect(match?.attributes).toEqual(args);
  });
});

describe.each([
  new HierarchicalCommand(
    'navigate_issues',
    ['navigate', 'go'],
    ['issue', 'issues'],
    ['details', 'detail'],
    ['page', 'pages']
  ),
  new HierarchicalCommand(
    'navigate_issues',
    ['navigate', 'go'],
    ['issue'],
    ['details', 'detail']
  ),
  new HierarchicalCommand(
    'navigate_issues',
    ['navigate', 'go'],
    ['issue', 'issues'],
    ['detail']
  ),
])('match hierarchical command for %s', (cmd: HierarchicalCommand) => {
  test('should not match', () => {
    const match = cmd.match({transcript: 'navigate to issues details', confidence: 0.9});
    expect(match).toBeNull();
  });
});

test('Hierarchical command rule', () => {
  const cmd = new HierarchicalCommand(
    'navigate',
    ['navigate', 'go'],
    ['options', 'option'],
    ['detail', 'details']
  );

  const expected =
    '<navigate_0> = navigate | go;\n<navigate_1> = options | option;\n<navigate_2> = detail | details;\npublic <navigate> = <navigate_0> <navigate_1> <navigate_2>;\n';

  expect(cmd.jsgfRule()).toEqual(expected);
});
