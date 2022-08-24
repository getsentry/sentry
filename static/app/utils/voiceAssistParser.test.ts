import {FuzzyCommand} from './voiceAssistParser';

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
