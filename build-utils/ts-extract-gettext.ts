import fs from 'node:fs/promises';
import path, {resolve} from 'node:path'; // Added for module check
import {fileURLToPath} from 'node:url';

import {ATTRIBUTE_METADATA} from '@sentry/conventions';
import {po} from 'gettext-parser';
import type {GetTextTranslation, GetTextTranslations} from 'gettext-parser';
import {glob} from 'tinyglobby';
import ts from 'typescript';

const FUNCTION_NAMES: Record<string, string[]> = {
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
  tctCode: ['msgid'],
};

function getTsScriptKind(filePath: string): ts.ScriptKind {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.ts':
      return ts.ScriptKind.TS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
      return ts.ScriptKind.JS;
    case '.json':
      return ts.ScriptKind.JSON;
    default:
      return ts.ScriptKind.Unknown;
  }
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

function extractTranslationsFromFileContent(
  filePath: string,
  code: string,
  gettextData: GetTextTranslations, // Modified in place
  nplurals: number,
  baseDirectory: string
): void {
  const relativePath = path.relative(baseDirectory, filePath);
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

      if (ts.isIdentifier(node.expression)) {
        funcName = node.expression.text;
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.name)
      ) {
        funcName = node.expression.name.text;
      }

      if (funcName && FUNCTION_NAMES.hasOwnProperty(funcName)) {
        const functionArgsInfo = FUNCTION_NAMES[funcName];
        const translate: Partial<GetTextTranslation> & {comments?: any} = {
          msgid: '',
          msgstr: [''],
        };

        for (let i = 0; i < functionArgsInfo.length; i++) {
          const name = functionArgsInfo[i];
          const argNode = node.arguments[i];

          if (!argNode) {
            continue;
          }

          if (name === 'msgid' || name === 'msgid_plural' || name === 'msgctxt') {
            let value: string | null = null;
            if (
              ts.isStringLiteral(argNode) ||
              ts.isNoSubstitutionTemplateLiteral(argNode)
            ) {
              value = argNode.text;
            }

            if (value !== null) {
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
        translate.comments.reference = `${relativePath}:${line + 1}`;

        let translatorComment = getTranslatorCommentFromTsNode(node, sourceFile);
        if (!translatorComment && node.parent) {
          translatorComment = getTranslatorCommentFromTsNode(node.parent, sourceFile);
        }

        if (translatorComment) {
          translate.comments.translator = translatorComment;
        }

        const msgctxt = translate.msgctxt ?? '';
        const currentContext = (gettextData.translations[msgctxt] =
          gettextData.translations[msgctxt] ?? {});

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
              if (!existingEntry.comments) {
                existingEntry.comments = {};
              }
              existingEntry.comments.reference = currentRefs.sort().join(`\n`);
            }
          }
          if (
            translate.comments?.translator &&
            !existingEntry.comments?.translator?.includes(translate.comments.translator)
          ) {
            if (!existingEntry.comments) {
              existingEntry.comments = {};
            }
            existingEntry.comments.translator =
              (existingEntry.comments.translator
                ? existingEntry.comments.translator + `\n`
                : '') + translate.comments.translator;
          }
          // Preserve msgid_plural if the new entry has one
          if (finalTranslateEntry.msgid_plural && !existingEntry.msgid_plural) {
            existingEntry.msgid_plural = finalTranslateEntry.msgid_plural;
            existingEntry.msgstr = finalTranslateEntry.msgstr;
          }
        } else {
          currentContext[finalTranslateEntry.msgid] = finalTranslateEntry;
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function extractBriefsFromAttributeMetadata(
  gettextData: GetTextTranslations,
  nplurals: number
): void {
  const context = gettextData.translations[''] ?? {};

  for (const [attributeName, metadata] of Object.entries(ATTRIBUTE_METADATA)) {
    const brief = metadata.brief;

    if (!brief || typeof brief !== 'string') {
      continue;
    }

    // Skip if already exists
    if (context[brief]) {
      continue;
    }

    const translate: GetTextTranslation = {
      msgid: brief,
      msgstr: [''],
      comments: {
        extracted: `Attribute \`${attributeName}\` metadata description from @sentry/conventions`,
      },
    };

    context[brief] = translate;
  }

  gettextData.translations[''] = context;
}

const OUTPUT_FILE = 'build/javascript.po';
const BASE_DIRECTORY = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function getFilesToProcess() {
  const files = await glob('static/**/*.{js,jsx,ts,tsx}', {
    cwd: BASE_DIRECTORY,
    absolute: true,
    ignore: ['**/node_modules/**'],
    onlyFiles: true,
  });
  console.log(`Found ${files.length.toLocaleString()} files to process`);
  return files;
}

async function main() {
  const gettextData: GetTextTranslations = {
    charset: 'UTF-8',
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
      'plural-forms': 'nplurals=2; plural=(n!=1)',
    },
    translations: {'': {}},
  };

  const pluralFormsHeader = gettextData.headers['plural-forms'] || '';
  const npluralsMatch = pluralFormsHeader.match(/nplurals\s*=\s*(\d+)/);
  const nplurals = npluralsMatch ? parseInt(npluralsMatch[1], 10) : 2;

  const files = await getFilesToProcess();

  const processFile = async (filePath: string) => {
    try {
      const code = await fs.readFile(filePath, 'utf8');
      extractTranslationsFromFileContent(
        filePath,
        code,
        gettextData,
        nplurals,
        BASE_DIRECTORY
      );
    } catch (error: unknown) {
      const relativePath = path.relative(BASE_DIRECTORY, filePath);
      console.error(
        `Error processing file ${relativePath} with TypeScript API:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  await Promise.all(files.map(processFile));

  // Extract briefs from ATTRIBUTE_METADATA
  extractBriefsFromAttributeMetadata(gettextData, nplurals);

  const outputFilePath = path.resolve(BASE_DIRECTORY, OUTPUT_FILE);
  const compiledPoBuffer = po.compile(gettextData, {sort: true});
  await fs.writeFile(outputFilePath, compiledPoBuffer, 'utf8');

  const numberOfTranslations = Object.keys(gettextData.translations['']).length;
  return numberOfTranslations;
}

const currentFilePath = fileURLToPath(import.meta.url);
const scriptPath = resolve(process.argv[1]);

if (currentFilePath === scriptPath) {
  main()
    .then(numberOfTranslations => {
      console.log(
        `Successfully wrote ${numberOfTranslations.toLocaleString()} translations to ${OUTPUT_FILE}`
      );
    })
    .catch(err => {
      console.error('An unexpected error occurred:', err);
      process.exit(1);
    });
}
