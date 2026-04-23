import {postProcessLLMMarkdown} from 'sentry/views/seerExplorer/utils';

describe('postProcessLLMMarkdown', () => {
  describe('issue short ID linkification', () => {
    it('linkifies a simple short ID', () => {
      expect(postProcessLLMMarkdown('see PROJECT-1 please')).toBe(
        'see [PROJECT-1](/issues/PROJECT-1/) please'
      );
    });

    it('linkifies multi-hyphen short IDs without truncating trailing segments', () => {
      expect(postProcessLLMMarkdown('caused by FRONTEND-REACT-59A today')).toBe(
        'caused by [FRONTEND-REACT-59A](/issues/FRONTEND-REACT-59A/) today'
      );
      expect(postProcessLLMMarkdown('BACKEND-FLASK-F2 is flaky')).toBe(
        '[BACKEND-FLASK-F2](/issues/BACKEND-FLASK-F2/) is flaky'
      );
      expect(postProcessLLMMarkdown('see BACKEND-RUBY-ON-RAILS-58')).toBe(
        'see [BACKEND-RUBY-ON-RAILS-58](/issues/BACKEND-RUBY-ON-RAILS-58/)'
      );
    });

    it('linkifies multiple short IDs in one string', () => {
      expect(
        postProcessLLMMarkdown('FRONTEND-REACT-59A and BACKEND-FLASK-F2 are related')
      ).toBe(
        '[FRONTEND-REACT-59A](/issues/FRONTEND-REACT-59A/) and [BACKEND-FLASK-F2](/issues/BACKEND-FLASK-F2/) are related'
      );
    });

    it('does not linkify lowercase tokens', () => {
      expect(postProcessLLMMarkdown('lowercase-not-matched here')).toBe(
        'lowercase-not-matched here'
      );
    });

    it('does not linkify short IDs inside existing markdown links', () => {
      const input = 'see [FRONTEND-REACT-59A](https://example.com/foo) for details';
      expect(postProcessLLMMarkdown(input)).toBe(input);
    });

    it('does not linkify short IDs inside inline code', () => {
      const input = 'the id `FRONTEND-REACT-59A` is raw';
      expect(postProcessLLMMarkdown(input)).toBe(input);
    });

    it('does not linkify short IDs inside URLs', () => {
      const input = 'go to https://example.com/issues/FRONTEND-REACT-59A now';
      expect(postProcessLLMMarkdown(input)).toBe(input);
    });

    it('returns empty string for null / undefined / empty input', () => {
      expect(postProcessLLMMarkdown(null)).toBe('');
      expect(postProcessLLMMarkdown(undefined)).toBe('');
      expect(postProcessLLMMarkdown('')).toBe('');
    });
  });
});
