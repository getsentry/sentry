import {useCallback, useEffect, useMemo, useState} from 'react';
import isEqual from 'lodash/isEqual';
import Prism from 'prismjs';

import {trackAnalytics} from 'sentry/utils/analytics';
import {getPrismLanguage, loadPrismLanguage} from 'sentry/utils/prism';
import useOrganization from 'sentry/utils/useOrganization';
import {breakTokensByLine} from 'sentry/utils/usePrismTokens';

type MultilineSyntax = {
  end: string;
  start: string;
};

const JS_MULTILINE_COMMENT_SYNTAX = [{start: '/*', end: '*/'}];

/**
 * Mappings for languages that have block comments or multiline strings.
 * Only syntaxes that can span multiple lines should be included.
 * For example, Python has triple-quoted strings, and JavaScript has block comments.
 */
const MULTILINE_SYNTAX_BY_LANGUAGE: Record<string, MultilineSyntax[]> = {
  python: [
    {start: '"""', end: '"""'},
    {start: "'''", end: "'''"},
  ],
  tsx: JS_MULTILINE_COMMENT_SYNTAX,
  jsx: JS_MULTILINE_COMMENT_SYNTAX,
  javascript: JS_MULTILINE_COMMENT_SYNTAX,
  typescript: JS_MULTILINE_COMMENT_SYNTAX,
};

const checkCodeForOpenMultilineSyntax = ({
  code,
  syntax,
  grammar,
  searchFrom,
}: {
  code: string;
  grammar: Prism.Grammar;
  searchFrom: 'start' | 'end';
  syntax: string;
}) => {
  if (!code.includes(syntax)) {
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
      if (token.includes(syntax)) {
        return true;
      }
    } else if (typeof token.content === 'string' && token.content.includes(syntax)) {
      return !(token.type === 'comment' || token.type === 'string');
    }
  }

  return true;
};

/**
 * Because we know that the executed line will _not_ be inside of a multiline
 * comment or string, we can check the before portion of the code to see if
 * it contains the end of a multline comment/string. If it does, we can see
 * assume that the multiline comment/string started before the recorded context.
 * We can do the same in reverse for the after portion of the code.
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
  const multilineSyntaxes = MULTILINE_SYNTAX_BY_LANGUAGE[language] ?? [];

  let prependedCode = '';
  let appendedCode = '';

  for (const {start, end} of multilineSyntaxes) {
    // Test before portion of code
    if (
      !prependedCode &&
      checkCodeForOpenMultilineSyntax({
        code: codeBefore,
        grammar,
        syntax: end,
        searchFrom: 'start',
      })
    ) {
      const linesBeforeModification = breakTokensByLine(
        Prism.tokenize(codeBefore, grammar)
      );
      const linesAfterModification = breakTokensByLine(
        Prism.tokenize(start + '\n' + codeBefore, grammar)
      );
      if (!isEqual(linesBeforeModification, linesAfterModification.slice(1))) {
        prependedCode = start + '\n';
      }
    }

    // Test the after portion of the code
    if (
      !appendedCode &&
      checkCodeForOpenMultilineSyntax({
        code: codeAfter,
        grammar,
        syntax: start,
        searchFrom: 'end',
      })
    ) {
      const linesBeforeModification = breakTokensByLine(
        Prism.tokenize(codeAfter, grammar)
      );
      const linesAfterModification = breakTokensByLine(
        Prism.tokenize(codeAfter + '\n' + end, grammar)
      );
      if (!isEqual(linesBeforeModification, linesAfterModification.slice(-1))) {
        appendedCode = end;
      }
    }
  }

  const tokens = Prism.tokenize(
    prependedCode + codeBefore + executedCode + codeAfter + appendedCode,
    grammar
  );

  const lines = breakTokensByLine(tokens);

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

  const fullLanguage = getPrismLanguage(fileExtension);
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
      return [];
    }
  }, [grammar, postCode, preCode, executedCode, fullLanguage, code]);

  return lines;
};
