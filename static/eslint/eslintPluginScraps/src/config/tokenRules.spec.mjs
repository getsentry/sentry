import assert from 'node:assert';
import {describe, it} from 'node:test';

import {
  findRuleForToken,
  matchesTokenPattern,
  PROPERTY_TO_RULE,
  TOKEN_RULES,
} from './tokenRules.mjs';

describe('matchesTokenPattern', () => {
  describe('content.* pattern', () => {
    it('matches direct content tokens', () => {
      assert.strictEqual(matchesTokenPattern('content.primary', 'content.*'), true);
      assert.strictEqual(matchesTokenPattern('content.secondary', 'content.*'), true);
      assert.strictEqual(matchesTokenPattern('content.accent', 'content.*'), true);
      assert.strictEqual(matchesTokenPattern('content.danger', 'content.*'), true);
    });

    it('matches nested content tokens', () => {
      assert.strictEqual(
        matchesTokenPattern('content.onVibrant.light', 'content.*'),
        true
      );
      assert.strictEqual(
        matchesTokenPattern('content.onVibrant.dark', 'content.*'),
        true
      );
    });

    it('does not match non-content tokens', () => {
      assert.strictEqual(matchesTokenPattern('background.primary', 'content.*'), false);
      assert.strictEqual(matchesTokenPattern('border.primary', 'content.*'), false);
    });

    it('does not match content without suffix', () => {
      assert.strictEqual(matchesTokenPattern('content', 'content.*'), false);
    });
  });

  describe('interactive.*.content pattern', () => {
    it('matches leaf content under interactive', () => {
      assert.strictEqual(
        matchesTokenPattern(
          'interactive.chonky.embossed.accent.content',
          'interactive.*.content'
        ),
        true
      );
      assert.strictEqual(
        matchesTokenPattern(
          'interactive.chonky.debossed.neutral.content',
          'interactive.*.content'
        ),
        true
      );
    });

    it('does not match content with nested value', () => {
      assert.strictEqual(
        matchesTokenPattern(
          'interactive.chonky.content.primary',
          'interactive.*.content'
        ),
        false
      );
    });
  });

  describe('interactive.*.content.* pattern', () => {
    it('matches nested content under interactive', () => {
      assert.strictEqual(
        matchesTokenPattern(
          'interactive.chonky.debossed.neutral.content.primary',
          'interactive.*.content.*'
        ),
        true
      );
    });
  });

  describe('interactive.link.* pattern', () => {
    it('matches link tokens', () => {
      assert.strictEqual(
        matchesTokenPattern('interactive.link.neutral.rest', 'interactive.link.*'),
        true
      );
      assert.strictEqual(
        matchesTokenPattern('interactive.link.accent.hover', 'interactive.link.*'),
        true
      );
    });

    it('does not match non-link interactive tokens', () => {
      assert.strictEqual(
        matchesTokenPattern('interactive.chonky.neutral', 'interactive.link.*'),
        false
      );
    });
  });
});

describe('findRuleForToken', () => {
  it('finds content rule for content tokens', () => {
    const rule = findRuleForToken('content.primary');
    assert.strictEqual(rule?.name, 'content');
  });

  it('finds content rule for nested content tokens', () => {
    const rule = findRuleForToken('content.onVibrant.light');
    assert.strictEqual(rule?.name, 'content');
  });

  it('finds content rule for interactive content tokens', () => {
    const rule = findRuleForToken('interactive.chonky.embossed.accent.content');
    assert.strictEqual(rule?.name, 'content');
  });

  it('finds content rule for interactive link tokens', () => {
    const rule = findRuleForToken('interactive.link.neutral.rest');
    assert.strictEqual(rule?.name, 'content');
  });

  it('returns null for non-matching tokens', () => {
    assert.strictEqual(findRuleForToken('background.primary'), null);
    assert.strictEqual(findRuleForToken('border.primary'), null);
    assert.strictEqual(findRuleForToken('shadow.elevationLow'), null);
  });
});

describe('TOKEN_RULES', () => {
  it('has content rule with expected properties', () => {
    const contentRule = TOKEN_RULES.find(r => r.name === 'content');
    assert.ok(contentRule);
    assert.ok(contentRule.allowedProperties.has('color'));
    assert.ok(contentRule.allowedProperties.has('text-decoration-color'));
    assert.ok(contentRule.allowedProperties.has('caret-color'));
    assert.ok(contentRule.allowedProperties.has('column-rule-color'));
    assert.ok(contentRule.allowedProperties.has('-webkit-text-fill-color'));
    assert.ok(contentRule.allowedProperties.has('-webkit-text-stroke-color'));
  });

  it('content rule does not allow non-color properties', () => {
    const contentRule = TOKEN_RULES.find(r => r.name === 'content');
    assert.ok(contentRule);
    assert.ok(!contentRule.allowedProperties.has('background'));
    assert.ok(!contentRule.allowedProperties.has('background-color'));
    assert.ok(!contentRule.allowedProperties.has('border-color'));
    assert.ok(!contentRule.allowedProperties.has('fill'));
    assert.ok(!contentRule.allowedProperties.has('stroke'));
  });
});

describe('PROPERTY_TO_RULE', () => {
  it('maps color properties to content rule', () => {
    assert.strictEqual(PROPERTY_TO_RULE.get('color'), 'content');
    assert.strictEqual(PROPERTY_TO_RULE.get('text-decoration-color'), 'content');
    assert.strictEqual(PROPERTY_TO_RULE.get('caret-color'), 'content');
  });

  it('returns undefined for unknown properties', () => {
    assert.strictEqual(PROPERTY_TO_RULE.get('background'), undefined);
    assert.strictEqual(PROPERTY_TO_RULE.get('unknown-property'), undefined);
  });
});
