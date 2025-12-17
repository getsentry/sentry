import fs from 'node:fs';

/**
 * Processes the Django loader.html template for use in the SPA index.ejs.
 *
 * Transforms:
 * - Strips `{% load ... %}` Django template directives
 * - Replaces `{% loading_message %}` with a static loading message
 */
export function processLoaderHtml(loaderPath: string): string {
  let content = fs.readFileSync(loaderPath, 'utf-8');

  // Strip {% load ... %} directive
  content = content.replace(/^\s*\{%\s*load\s+[^%]+%\}\s*\n?/, '');

  // Replace {% loading_message %} with static message
  content = content.replace(
    /\{%\s*loading_message\s*%\}/,
    'Loading a <scraps-bleep>$#!%</scraps-bleep>-ton of JavaScript&hellip;'
  );

  return content;
}
