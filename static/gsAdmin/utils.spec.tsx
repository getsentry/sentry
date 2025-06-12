import {generatePromoCode} from 'admin/utils';

describe('generatePromoCode', function () {
  // Known cryptic words from the function
  const CRYPTIC_WORDS = [
    'shadow',
    'mystic',
    'cipher',
    'stealth',
    'vortex',
    'nexus',
    'phantom',
    'quantum',
    'matrix',
    'eclipse',
    'zenith',
    'fusion',
    'vertex',
    'prism',
    'flux',
    'nova',
    'cosmic',
    'azure',
    'ember',
    'frost',
    'onyx',
    'storm',
    'blaze',
    'spark',
    'mist',
    'void',
    'core',
    'byte',
    'node',
    'link',
    'grid',
    'arch',
  ];

  // Expected character set from the function
  const EXPECTED_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%&*+=';
  const L33T_SUBSTITUTIONS = ['@', '4', '3', '1', '!', '0', '5', '$', '7', '9', '8'];

  describe('basic requirements', function () {
    it('generates codes with correct length range (10-15 characters)', function () {
      for (let i = 0; i < 50; i++) {
        const code = generatePromoCode();
        expect(code.length).toBeGreaterThanOrEqual(10);
        expect(code.length).toBeLessThanOrEqual(15);
      }
    });

    it('always returns a string', function () {
      for (let i = 0; i < 20; i++) {
        const code = generatePromoCode();
        expect(typeof code).toBe('string');
        expect(code).toBeTruthy();
      }
    });

    it('generates different codes on multiple calls', function () {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        codes.add(generatePromoCode());
      }
      // Should have generated many unique codes (allowing for small chance of collisions)
      expect(codes.size).toBeGreaterThan(45);
    });
  });

  describe('word inclusion', function () {
    it('contains at least one cryptic word or its l33t variant', function () {
      for (let i = 0; i < 30; i++) {
        const code = generatePromoCode().toLowerCase();

        // Check if any cryptic word (or l33t variant) is present
        const containsWord = CRYPTIC_WORDS.some(word => {
          // Check original word
          if (code.includes(word)) return true;

          // Check l33t variants by creating possible substitutions
          const l33tVariants = generateL33tVariants(word);
          return l33tVariants.some(variant => code.includes(variant));
        });

        expect(containsWord).toBe(true);
      }
    });

    it('contains only one cryptic word base (not multiple)', function () {
      for (let i = 0; i < 20; i++) {
        const code = generatePromoCode().toLowerCase();

        let wordCount = 0;
        CRYPTIC_WORDS.forEach(word => {
          if (code.includes(word)) {
            wordCount++;
          }
        });

        // Should contain at most one complete original word
        expect(wordCount).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('character composition', function () {
    it('contains only allowed characters', function () {
      for (let i = 0; i < 30; i++) {
        const code = generatePromoCode();

        for (const char of code) {
          expect(EXPECTED_CHARS).toContain(char.toLowerCase());
        }
      }
    });

    it('contains mix of letters, numbers, and/or symbols', function () {
      const codes = [];
      for (let i = 0; i < 50; i++) {
        codes.push(generatePromoCode());
      }

      // Check that across all codes, we see variety
      const hasLetters = codes.some(code => /[a-z]/i.test(code));
      const hasNumbers = codes.some(code => /[0-9]/.test(code));
      const hasSymbols = codes.some(code => /[!@#$%&*+=]/.test(code));

      expect(hasLetters).toBe(true);
      expect(hasNumbers).toBe(true);
      expect(hasSymbols).toBe(true);
    });

    it('applies l33t speak substitutions to words', function () {
      let foundL33tSubs = false;

      for (let i = 0; i < 50; i++) {
        const code = generatePromoCode();

        // Check if any l33t substitution characters are present
        if (L33T_SUBSTITUTIONS.some(sub => code.includes(sub))) {
          foundL33tSubs = true;
          break;
        }
      }

      expect(foundL33tSubs).toBe(true);
    });
  });

  describe('word positioning', function () {
    it('places words in different positions (prefix, suffix, middle)', function () {
      const positionResults = {
        prefix: false,
        suffix: false,
        middle: false,
      };

      for (let i = 0; i < 100; i++) {
        const code = generatePromoCode().toLowerCase();

        // Check each cryptic word for positioning
        for (const word of CRYPTIC_WORDS) {
          const wordVariants = generateL33tVariants(word);

          for (const variant of [word, ...wordVariants]) {
            const index = code.indexOf(variant);
            if (index !== -1) {
              const isPrefix = index === 0;
              const isSuffix = index + variant.length === code.length;
              const isMiddle = !isPrefix && !isSuffix;

              if (isPrefix) positionResults.prefix = true;
              if (isSuffix) positionResults.suffix = true;
              if (isMiddle) positionResults.middle = true;

              break;
            }
          }

          // Break if we found all positions
          if (
            positionResults.prefix &&
            positionResults.suffix &&
            positionResults.middle
          ) {
            break;
          }
        }

        if (positionResults.prefix && positionResults.suffix && positionResults.middle) {
          break;
        }
      }

      // Should have found examples of all three positions
      expect(positionResults.prefix).toBe(true);
      expect(positionResults.suffix).toBe(true);
      expect(positionResults.middle).toBe(true);
    });
  });

  describe('edge cases', function () {
    it('handles long words correctly by truncating', function () {
      // This tests the edge case handling when word is very long
      for (let i = 0; i < 20; i++) {
        const code = generatePromoCode();
        expect(code.length).toBeLessThanOrEqual(15);
      }
    });

    it('ensures minimum length even with short words', function () {
      for (let i = 0; i < 20; i++) {
        const code = generatePromoCode();
        expect(code.length).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe('randomness distribution', function () {
    it('generates codes with varying lengths within range', function () {
      const lengths = new Set();

      for (let i = 0; i < 100; i++) {
        lengths.add(generatePromoCode().length);
      }

      // Should see multiple different lengths
      expect(lengths.size).toBeGreaterThan(3);

      // All lengths should be in valid range
      lengths.forEach(length => {
        expect(length).toBeGreaterThanOrEqual(10);
        expect(length).toBeLessThanOrEqual(15);
      });
    });

    it('shows good distribution of cryptic words usage', function () {
      const wordUsage = new Set();

      for (let i = 0; i < 200; i++) {
        const code = generatePromoCode().toLowerCase();

        // Find which word was used
        for (const word of CRYPTIC_WORDS) {
          if (
            code.includes(word) ||
            generateL33tVariants(word).some(v => code.includes(v))
          ) {
            wordUsage.add(word);
            break;
          }
        }
      }

      // Should use a good variety of words (at least 50% of available words)
      expect(wordUsage.size).toBeGreaterThan(CRYPTIC_WORDS.length * 0.5);
    });
  });
});

/**
 * Helper function to generate possible l33t speak variants of a word
 */
function generateL33tVariants(word: string): string[] {
  const substitutions: Record<string, string[]> = {
    a: ['@', '4'],
    e: ['3'],
    i: ['1', '!'],
    o: ['0'],
    s: ['5', '$'],
    t: ['7'],
    l: ['1'],
    g: ['9'],
    b: ['8'],
  };

  const variants: string[] = [];
  const chars = word.toLowerCase().split('');

  // Generate a few common l33t variants (not all possible combinations)
  // This is a simplified version for testing purposes
  let variant1 = '';
  let variant2 = '';

  chars.forEach(char => {
    if (substitutions[char]) {
      variant1 += substitutions[char][0]; // First substitution
      variant2 += substitutions[char][1] || substitutions[char][0]; // Second if available
    } else {
      variant1 += char;
      variant2 += char;
    }
  });

  variants.push(variant1);
  if (variant2 !== variant1) {
    variants.push(variant2);
  }

  return variants;
}
