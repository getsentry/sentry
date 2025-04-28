import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {globSync} from 'tinyglobby';
import ts from 'typescript';
import {po} from 'gettext-parser';
import type {
  GetTextComment,
  GetTextTranslation,
  GetTextTranslations,
} from 'gettext-parser';

/**
 * Strips indentation from multi-line strings, particularly template literals.
 * It removes the minimal indentation shared across all non-empty lines.
 */
function stripIndent(str: string | null | undefined): string {
  // Original implementation might be too aggressive, let's keep the multi-line logic
  // but ensure we handle potential undefined/null inputs gracefully.
  if (typeof str !== 'string') {
    return str || ''; // Return empty string for null/undefined
  }
  const match = str.match(/^[ \t]*(?=\S)/gm);
  if (!match) {
    return str.trim(); // Trim leading/trailing whitespace if no indentation detected
  }

  const indent = Math.min(...match.map(el => el.length));
  const regexp = new RegExp(`^[ \t]{${indent}}`, 'gm');
  // Replace indentation and trim the final result
  return (indent > 0 ? str.replace(regexp, '') : str).trim();
}

/**
 * Represents the comments associated with a translation entry.
 */
interface Comments {
  reference?: string;
  translator?: string;
  extracted?: string;
  flag?: string;
  previous?: string;
}

/**
 * Represents a single translation entry.
 */
interface TranslationEntry {
  msgid: string;
  msgctxt?: string;
  msgid_plural?: string;
  msgstr?: string[]; // msgstr is typically an array for plural forms
  comments?: Comments;
}

/**
 * Represents the structure for gettext data.
 * Contexts map to objects containing msgid keys mapped to TranslationEntry objects.
 */
interface GettextDataStructure {
  charset: string;
  headers: Record<string, string>;
  translations: {
    [context: string]: {
      [msgid: string]: TranslationEntry;
    };
  };
}

/**
 * Sorts the keys of an object containing gettext translation entries
 * based on their reference comments.
 */
function sortObjectKeysByRef(
  unordered: {[msgid: string]: GetTextTranslation} | undefined
): {[msgid: string]: GetTextTranslation} {
  if (!unordered) {
    return {};
  }
  const ordered: {[msgid: string]: GetTextTranslation} = {};
  Object.keys(unordered)
    .sort((a, b) => {
      const refA = (unordered[a]?.comments?.reference || '').toLowerCase();
      const refB = (unordered[b]?.comments?.reference || '').toLowerCase();
      if (refA < refB) {
        return -1;
      }
      if (refA > refB) {
        return 1;
      }
      return 0;
    })
    .forEach(function (key) {
      ordered[key] = unordered[key];
    });
  return ordered;
}

// --- Configuration ---
const OUTPUT_FILE = 'build/javascript.po';
const BASE_DIRECTORY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_FILES_PATTERN = 'static/**/*.{js,jsx,ts,tsx}';
const EXCLUDE_PATTERN = '**/node_modules/**';

// Define a type for the function argument names
type ArgName = 'msgid' | 'domain' | 'msgid_plural' | 'count' | 'msgctxt';

const FUNCTION_NAMES: Record<string, ArgName[]> = {
  gettext: ['msgid'],
  dgettext: ['domain', 'msgid'],
  ngettext: ['msgid', 'msgid_plural', 'count'],
  dngettext: ['domain', 'msgid', 'msgid_plural', 'count'],
  pgettext: ['msgctxt', 'msgid'],
  dpgettext: ['domain', 'msgctxt', 'msgid'],
  npgettext: ['msgctxt', 'msgid', 'msgid_plural', 'count'],
  dnpgettext: ['domain', 'msgctxt', 'msgid', 'msgid_plural', 'count'],
  // Sentry specific
  gettextComponentTemplate: ['msgid'],
  t: ['msgid'],
  tn: ['msgid', 'msgid_plural', 'count'],
  tct: ['msgid'],
};

const DEFAULT_HEADERS: Record<string, string> = {
  'content-type': 'text/plain; charset=UTF-8',
  'plural-forms': 'nplurals=2; plural=(n!=1)',
};

const STRIP_TEMPLATE_LITERAL_INDENT = true;

function getTsScriptKind(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.tsx') return ts.ScriptKind.TSX;
  if (ext === '.ts') return ts.ScriptKind.TS;
  if (ext === '.jsx') return ts.ScriptKind.JSX;
  if (ext === '.js') return ts.ScriptKind.JS;
  if (ext === '.json') return ts.ScriptKind.JSON;
  return ts.ScriptKind.Unknown;
}

function getTranslatorCommentFromTsNode(
  node: ts.Node,
  sourceFile: ts.SourceFile
): string | null {
  const fullText = sourceFile.getFullText();
  const commentRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart());
  if (!commentRanges) {
    return null;
  }

  const comments: string[] = [];
  commentRanges.forEach(range => {
    const commentText = fullText.substring(range.pos, range.end);
    let commentValue = '';
    if (commentText.startsWith('//')) {
      commentValue = commentText.substring(2);
    } else if (commentText.startsWith('/*')) {
      commentValue = commentText.substring(2, commentText.length - 2);
    }
    const match = commentValue.match(/^\s*translators:\s*(.*?)\s*$/im);
    if (match) {
      comments.push(match[1].trim());
    }
  });

  return comments.length > 0 ? comments.join(`\n`) : null;
}

function ensureDirectoryExistence(filePath: string): void {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return;
  }
  ensureDirectoryExistence(dirname);
  try {
    fs.mkdirSync(dirname);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
}

const gettextData: GetTextTranslations = {
  charset: 'UTF-8',
  headers: DEFAULT_HEADERS,
  translations: {'': {}},
};

const pluralFormsHeader = gettextData.headers['plural-forms'] || '';
const npluralsMatch = pluralFormsHeader.match(/nplurals\\s*=\\s*(\\d+)/);
const nplurals = npluralsMatch ? parseInt(npluralsMatch[1], 10) : 2;

console.log(`Starting gettext extraction...`);
console.log(`Base directory: ${BASE_DIRECTORY}`);
console.log(`Output file: ${OUTPUT_FILE}`);

const files = globSync(SOURCE_FILES_PATTERN, {
  cwd: BASE_DIRECTORY,
  absolute: true,
  ignore: [EXCLUDE_PATTERN],
  onlyFiles: true,
});

console.log(`Found ${files.length} files to process.`);
let filesProcessed = 0;

files.forEach(filePath => {
  const relativePath = path.relative(BASE_DIRECTORY, filePath);
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      path.basename(filePath),
      code,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      getTsScriptKind(filePath)
    );

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        let funcName: string | null = null;
        const expression = node.expression;

        if (ts.isIdentifier(expression)) {
          funcName = expression.text;
        } else if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.name)
        ) {
          funcName = expression.name.text;
        }

        if (funcName && FUNCTION_NAMES.hasOwnProperty(funcName)) {
          const functionArgsInfo = FUNCTION_NAMES[funcName];
          const translate: Partial<GetTextTranslation> = {
            msgid: '',
            msgstr: [''], // Initialize msgstr
          };

          for (let i = 0; i < functionArgsInfo.length; i++) {
            const name = functionArgsInfo[i];
            const argNode = node.arguments[i];

            if (!argNode) continue;

            if (name === 'msgid' || name === 'msgid_plural' || name === 'msgctxt') {
              let value: string | null = null;
              if (
                ts.isStringLiteral(argNode) ||
                ts.isNoSubstitutionTemplateLiteral(argNode)
              ) {
                value = argNode.text;
              }

              if (value !== null) {
                if (STRIP_TEMPLATE_LITERAL_INDENT && name !== 'msgctxt') {
                  value = stripIndent(value);
                }
                translate[name] = value;
              }
            }
          }

          if (typeof translate.msgid !== 'string' || !translate.msgid) {
            return;
          }

          if (translate.msgid_plural) {
            translate.msgstr = Array(nplurals).fill('');
          }

          const {line} = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile)
          );
          translate.comments = translate.comments || {};
          (translate.comments as GetTextComment).reference = `${relativePath}:${
            line + 1
          }`;

          let translatorComment = getTranslatorCommentFromTsNode(node, sourceFile);
          if (!translatorComment && node.parent) {
            translatorComment = getTranslatorCommentFromTsNode(node.parent, sourceFile);
          }

          if (translatorComment) {
            (translate.comments as GetTextComment).translator = translatorComment;
          }

          const msgctxt = translate.msgctxt || '';
          const currentContext = (gettextData.translations[msgctxt] =
            gettextData.translations[msgctxt] || {});

          const finalTranslateEntry = translate as GetTextTranslation;

          if (currentContext[finalTranslateEntry.msgid]) {
            const existingEntry = currentContext[finalTranslateEntry.msgid];
            const newRef = finalTranslateEntry.comments?.reference;
            if (newRef) {
              let currentRefs = (existingEntry.comments?.reference || '')
                .split(`\n`)
                .filter(Boolean);
              if (!currentRefs.includes(newRef)) {
                currentRefs.push(newRef);
                if (!existingEntry.comments) existingEntry.comments = {};
                existingEntry.comments.reference = currentRefs.sort().join(`\n`);
              }
            }
            if (
              translate.comments?.translator &&
              !existingEntry.comments?.translator?.includes(translate.comments.translator)
            ) {
              if (!existingEntry.comments) existingEntry.comments = {};
              existingEntry.comments.translator =
                (existingEntry.comments.translator
                  ? existingEntry.comments.translator + `\n`
                  : '') + translate.comments.translator;
            }
          } else {
            currentContext[finalTranslateEntry.msgid] = finalTranslateEntry;
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    filesProcessed++;
  } catch (error: unknown) {
    console.error(
      `Error processing file ${relativePath} with TypeScript API:`,
      error instanceof Error ? error.message : String(error)
    );
  }
});

Object.keys(gettextData.translations).forEach(contextKey => {
  const context = gettextData.translations[contextKey];
  if (context && typeof context === 'object' && Object.keys(context).length > 0) {
    gettextData.translations[contextKey] = sortObjectKeysByRef(context);
  }
});

try {
  const outputFilePath = path.resolve(BASE_DIRECTORY, OUTPUT_FILE);
  ensureDirectoryExistence(outputFilePath);
  const compiledPoBuffer = po.compile(gettextData, {});

  let compiledPoString = compiledPoBuffer.toString('utf8');

  fs.writeFileSync(outputFilePath, compiledPoString, 'utf8');

  console.log(`Successfully wrote translations to ${OUTPUT_FILE}`);
  console.log(`Processed ${filesProcessed} out of ${files.length} files.`);
} catch (error: unknown) {
  console.error(
    `Error writing output file ${OUTPUT_FILE}:`,
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}
