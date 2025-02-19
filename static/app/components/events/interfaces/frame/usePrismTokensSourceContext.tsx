import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import Prism from 'prismjs';

import {trackAnalytics} from 'sentry/utils/analytics';
import {getPrismLanguage, loadPrismLanguage} from 'sentry/utils/prism';
import useOrganization from 'sentry/utils/useOrganization';
import {breakTokensByLine} from 'sentry/utils/usePrismTokens';

type ComplexSyntax = {
  example: string;
  search: RegExp;
};

type BlockCommentSyntax = {
  end: string | ComplexSyntax;
  start: string | ComplexSyntax;
};

// Most languages use C-style block comments, so we default to that unless otherwise specified.
const DEFAULT_BLOCK_COMMENT_SYNTAX = [{start: '/*', end: '*/'}];

/**
 * Mappings for languages use non-C-style block comments.
 * For example, Python has triple-quoted strings. See wikipedia for a full list [1].
 *
 * Some syntaxes are more complex than a simple start/end string. For example, Perl
 * begins block comments with a `=` and any number of characters. For dynamic syntaxes
 * like these, we use a ComplexSyntax object, which contains a search regex and an example
 * which is used when beginning/terminating the open code block.
 *
 * [1]: https://en.wikipedia.org/wiki/Comparison_of_programming_languages_(syntax)#Comment_comparison
 */
const BLOCK_COMMENT_SYNTAX_BY_LANGUAGE: Record<string, BlockCommentSyntax[]> = {
  bash: [],
  elixir: [{start: '"""', end: '"""'}],
  haskell: [{start: '{-', end: '-}'}],
  julia: [{start: '#=', end: '=#'}],
  lua: [{start: '--[[', end: ']]'}],
  perl: [{start: {example: '=comment', search: /^\s*?=\S+/m}, end: '=cut'}],
  powershell: [{start: '<#', end: '#>'}],
  python: [
    {start: '"""', end: '"""'},
    {start: "'''", end: "'''"},
  ],
  ruby: [{start: '=begin', end: '=end'}],
};

const isTokenStringOrComment = (token: Prism.Token) => {
  if (token.type === 'comment' || token.type === 'string') {
    return true;
  }

  if (typeof token.alias === 'string') {
    return token.alias === 'comment' || token.alias === 'string';
  }

  if (Array.isArray(token.alias)) {
    return token.alias.some(a => a === 'comment' || a === 'string');
  }

  return false;
};

const containsBlockCommentSyntax = ({
  code,
  syntax,
}: {
  code: string;
  syntax: string | ComplexSyntax;
}) => {
  if (typeof syntax === 'string') {
    return code.includes(syntax);
  }

  return syntax.search.test(code);
};

const checkCodeForOpenBlockComment = ({
  code,
  syntax,
  grammar,
  searchFrom,
}: {
  code: string;
  grammar: Prism.Grammar;
  searchFrom: 'start' | 'end';
  syntax: string | ComplexSyntax;
}) => {
  if (!containsBlockCommentSyntax({code, syntax})) {
    return false;
  }

  const tokens = Prism.tokenize(code, grammar);

  if (searchFrom === 'end') {
    tokens.reverse();
  }

  for (const token of tokens) {
    // If the token contains the syntax, we check to see if it's already parsed
    // as a comment or string. We only mark the syntax as open if it's not within
    // those token types.
    if (typeof token === 'string') {
      if (containsBlockCommentSyntax({code: token, syntax})) {
        return true;
      }
    } else if (
      typeof token.content === 'string' &&
      containsBlockCommentSyntax({code: token.content, syntax})
    ) {
      return !isTokenStringOrComment(token);
    }
  }

  return true;
};

/**
 * Because we know that the executed line will _not_ be inside of a block
 * comment, we can check the before portion of the code to see if it contains
 * the end of a block comment. If it does, we can assume that the block comment
 * started before the recorded context. We can do the same in reverse for the
 * after portion of the code.
 */
const tokenizeSourceContext = ({
  preCode: codeBefore,
  executedCode,
  postCode: codeAfter,
  language,
  grammar,
}: {
  executedCode: string;
  grammar: Prism.Grammar;
  language: string;
  postCode: string;
  preCode: string;
}) => {
  const multilineSyntaxes =
    BLOCK_COMMENT_SYNTAX_BY_LANGUAGE[language] ?? DEFAULT_BLOCK_COMMENT_SYNTAX;

  let prependedCode = '';
  let appendedCode = '';

  for (const {start, end} of multilineSyntaxes) {
    // Test before portion of code
    if (
      !prependedCode &&
      checkCodeForOpenBlockComment({
        code: codeBefore,
        grammar,
        syntax: end,
        searchFrom: 'start',
      })
    ) {
      const beginBlockCommentSyntax = typeof start === 'string' ? start : start.example;
      const linesBeforeModification = breakTokensByLine(
        Prism.tokenize(codeBefore, grammar)
      );
      const linesAfterModification = breakTokensByLine(
        Prism.tokenize(beginBlockCommentSyntax + '\n' + codeBefore, grammar)
      );
      if (!isEqual(linesBeforeModification, linesAfterModification.slice(1))) {
        prependedCode = beginBlockCommentSyntax + '\n';
      }
    }

    // Test the after portion of the code
    if (
      !appendedCode &&
      checkCodeForOpenBlockComment({
        code: codeAfter,
        grammar,
        syntax: start,
        searchFrom: 'end',
      })
    ) {
      const endBlockCommentSyntax = typeof end === 'string' ? end : end.example;
      const linesBeforeModification = breakTokensByLine(
        Prism.tokenize(codeAfter, grammar)
      );
      const linesAfterModification = breakTokensByLine(
        Prism.tokenize(codeAfter + '\n' + endBlockCommentSyntax, grammar)
      );
      if (!isEqual(linesBeforeModification, linesAfterModification.slice(-1))) {
        appendedCode = endBlockCommentSyntax;
      }
    }
  }

  // Tokenize with the prepended and appended code account for any open block comments
  const tokens = Prism.tokenize(
    prependedCode + codeBefore + executedCode + codeAfter + appendedCode,
    grammar
  );

  const lines = breakTokensByLine(tokens);

  // Clean up any prepended/appended code to ensure the content is unchanged
  return lines.slice(prependedCode ? 1 : 0, appendedCode ? -1 : undefined);
};

// Some events have context lines with newline characters at the end,
// so we need to remove them to be consistent.
const normalizeLineEndings = (line?: string) => {
  return line?.replaceAll(/\r?\n/g, '') ?? '';
};

const convertContextLines = (
  contextLines: Array<[number, string]>,
  executedLineNo: number | null
) => {
  if (!executedLineNo) {
    return {
      preCode: '',
      executedCode: contextLines.map(([, line]) => normalizeLineEndings(line)).join('\n'),
      postCode: '',
    };
  }

  let preCode = '';
  let executedCode = '';
  let postCode = '';

  for (const [lineNo, lineContent] of contextLines) {
    if (lineNo < executedLineNo) {
      preCode += normalizeLineEndings(lineContent) + '\n';
    } else if (lineNo === executedLineNo) {
      executedCode = normalizeLineEndings(lineContent) + '\n';
    } else {
      postCode += normalizeLineEndings(lineContent) + '\n';
    }
  }

  return {preCode, executedCode, postCode};
};

/**
 * Similar to usePrismTokens, but contains some modifications for event source context.
 * Because source context is only a small portion of the file, there are certain cases
 * which don't work well with syntax highlighting - specifically, multiline strings and
 * block comments. This hook attempts to correct for those cases.
 */
export const usePrismTokensSourceContext = ({
  contextLines = [],
  lineNo,
  fileExtension,
}: {
  fileExtension: string;
  lineNo: number | null;
  contextLines?: Array<[number, string]>;
}) => {
  const organization = useOrganization({allowNull: true});

  const fullLanguage = getPrismLanguage(fileExtension)!;
  const {preCode, executedCode, postCode} = convertContextLines(contextLines, lineNo);
  const code = preCode + executedCode + postCode;

  const [grammar, setGrammar] = useState<Prism.Grammar | null>(
    () => Prism.languages[fullLanguage] ?? null
  );

  const onLoad = useCallback(() => {
    setGrammar(Prism.languages[fullLanguage] ?? null);
  }, [fullLanguage]);

  useEffect(() => {
    if (!fileExtension || !code || fileExtension.includes('/')) {
      return;
    }

    if (!getPrismLanguage(fileExtension)) {
      trackAnalytics('stack_trace.prism_missing_language', {
        organization,
        attempted_language: fileExtension.toLowerCase(),
      });
      return;
    }

    loadPrismLanguage(fileExtension, {onLoad});
  }, [code, fileExtension, onLoad, organization]);

  const lines = useMemo(() => {
    try {
      if (!grammar) {
        return breakTokensByLine([code]);
      }
      return tokenizeSourceContext({
        postCode,
        preCode,
        executedCode,
        language: fullLanguage,
        grammar,
      });
    } catch (e) {
      Sentry.captureException(e);
      return [];
    }
  }, [grammar, postCode, preCode, executedCode, fullLanguage, code]);

  return lines;
};
