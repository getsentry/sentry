'use strict';

/**
 * Generates src/sentry/locale/uwu/LC_MESSAGES/django.po from the extracted
 * frontend message catalog.
 *
 * Every candidate translation passes a validation gate before it reaches the
 * catalog. Anything that fails falls back to the deterministic engine, and if
 * that fails too the entry is dropped so gettext serves the english msgid. The
 * catalog is therefore valid by construction rather than by inspection.
 *
 * Usage:
 *   pnpm build-js-po && pnpm gen:uwu-catalog
 *
 * Set UWU_CANDIDATES to a JSON file mapping msgid to a hand- or model-authored
 * translation to have those preferred wherever they pass the gate.
 */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import * as path from 'node:path';

import {po} from 'gettext-parser';
import type {GetTextTranslations} from 'gettext-parser';

/* eslint-disable boundaries/dependencies -- codegen script */
import {
  getSprintfTokens,
  getTemplateGroups,
  uwuify,
} from '../static/app/utils/uwu/transform';
/* eslint-enable boundaries/dependencies */

const SOURCE_PATH = 'build/javascript.po';
const OUT_PATH = 'src/sentry/locale/uwu/LC_MESSAGES/django.po';

/**
 * Generous enough to allow a stutter and a face, tight enough to catch a
 * candidate that has started writing prose of its own.
 */
const MAX_LENGTH_RATIO = 1.6;

interface Rejection {
  msgid: string;
  reason: string;
}

function sameTokens(source: string, candidate: string): boolean {
  return (
    getSprintfTokens(source).join('') === getSprintfTokens(candidate).join('') &&
    getTemplateGroups(source).join('') === getTemplateGroups(candidate).join('')
  );
}

function validate(source: string, candidate: string): string | null {
  if (candidate.trim() === '') {
    return 'empty';
  }
  if (!sameTokens(source, candidate)) {
    return 'placeholders';
  }
  if (candidate.length > Math.max(16, source.length * MAX_LENGTH_RATIO)) {
    return 'too long';
  }
  return null;
}

function translate(
  source: string,
  candidates: Record<string, string>,
  rejections: Rejection[]
): string | null {
  const candidate = candidates[source];

  if (candidate !== undefined) {
    const reason = validate(source, candidate);
    if (reason === null) {
      return candidate;
    }
    rejections.push({msgid: source, reason: `candidate: ${reason}`});
  }

  const generated = uwuify(source);
  const reason = validate(source, generated);

  if (reason === null) {
    return generated;
  }

  rejections.push({msgid: source, reason: `generated: ${reason}`});
  return null;
}

function readCandidates(): Record<string, string> {
  const candidatesPath = process.env.UWU_CANDIDATES;

  if (!candidatesPath) {
    return {};
  }

  return JSON.parse(readFileSync(candidatesPath, 'utf8'));
}

function main() {
  const baseDirectory = process.cwd();
  const source = po.parse(readFileSync(path.resolve(baseDirectory, SOURCE_PATH)));
  const candidates = readCandidates();
  const rejections: Rejection[] = [];

  const translations: GetTextTranslations['translations'] = {};
  let accepted = 0;
  let dropped = 0;

  for (const [context, entries] of Object.entries(source.translations)) {
    for (const entry of Object.values(entries)) {
      if (!entry.msgid) {
        continue;
      }

      const singular = translate(entry.msgid, candidates, rejections);

      if (singular === null) {
        dropped++;
        continue;
      }

      const msgstr = [singular];

      if (entry.msgid_plural) {
        const plural = translate(entry.msgid_plural, candidates, rejections);
        if (plural === null) {
          dropped++;
          continue;
        }
        msgstr.push(plural);
      }

      translations[context] ??= {};
      translations[context][entry.msgid] = {
        msgid: entry.msgid,
        ...(entry.msgid_plural ? {msgid_plural: entry.msgid_plural} : {}),
        msgstr,
        // po-catalog-loader.ts drops any message whose reference comment does not
        // point at a frontend file, so the references have to survive codegen.
        ...(entry.comments ? {comments: entry.comments} : {}),
      };
      accepted++;
    }
  }

  const catalog: GetTextTranslations = {
    charset: 'utf-8',
    headers: {
      'content-type': 'text/plain; charset=UTF-8',
      'content-transfer-encoding': '8bit',
      language: 'uwu',
      'plural-forms': 'nplurals=2; plural=(n != 1);',
      'mime-version': '1.0',
      'project-id-version': 'sentry',
    },
    translations,
  };

  const outPath = path.resolve(baseDirectory, OUT_PATH);
  mkdirSync(path.dirname(outPath), {recursive: true});
  writeFileSync(outPath, po.compile(catalog, {sort: true}));

  const byReason = rejections.reduce<Record<string, number>>((counts, rejection) => {
    counts[rejection.reason] = (counts[rejection.reason] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`wrote ${accepted.toLocaleString()} translations to ${OUT_PATH}`);
  console.log(`dropped ${dropped}`);
  for (const [reason, count] of Object.entries(byReason)) {
    console.log(`  rejected (${reason}): ${count}`);
  }
  for (const rejection of rejections.slice(0, 10)) {
    console.log(`    ${rejection.reason}: ${JSON.stringify(rejection.msgid)}`);
  }
}

main();
