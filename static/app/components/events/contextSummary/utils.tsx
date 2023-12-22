import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {Context} from './types';

/**
 * Generates a predicate to filter a list of contexts for an event.
 *
 * This is highly domain logic.
 */
export const makeContextFilter = (event: Event) =>
  function (context: Context) {
    // if the operating system is macOS, we want to hide devices called "Mac"
    // which don't have any additional info
    if (context.keys.includes('device')) {
      const {model, arch} = event.contexts?.device ?? {};
      const {name: os} = event.contexts?.os ?? event.contexts?.client_os ?? {};

      if (model === 'Mac' && !arch && os?.toLowerCase().includes('mac')) {
        return false;
      }
    }

    if (event.sdk?.name === 'sentry.javascript.nextjs') {
      if (context.keys.includes('browser')) {
        const runtime = event.contexts?.runtime;

        if (runtime?.name !== 'browser') {
          return false;
        }
      }
    }

    // do not show the context summary if only runtime raw_description is defined
    // (without name or version)
    if (
      context.keys.includes('runtime') &&
      event.contexts.runtime?.raw_description &&
      !(event.contexts.runtime?.name || event.contexts.runtime?.version)
    ) {
      return false;
    }

    return true;
  };

/**
 * Generates the class name used for contexts
 */
export function generateIconName(
  name?: string | boolean | null,
  version?: string
): string {
  if (!defined(name) || typeof name === 'boolean') {
    return '';
  }

  const lowerCaseName = name.toLowerCase();

  // amazon fire tv device id changes with version: AFTT, AFTN, AFTS, AFTA, AFTVA (alexa), ...
  if (lowerCaseName.startsWith('aft')) {
    return 'amazon';
  }

  if (lowerCaseName.startsWith('sm-') || lowerCaseName.startsWith('st-')) {
    return 'samsung';
  }

  if (lowerCaseName.startsWith('moto')) {
    return 'motorola';
  }

  if (lowerCaseName.startsWith('pixel')) {
    return 'google';
  }

  const formattedName = name
    .split(/\d/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/\-+$/, '')
    .replace(/^\-+/, '');

  if (formattedName === 'edge' && version) {
    const majorVersion = version.split('.')[0];
    const isLegacyEdge = majorVersion >= '12' && majorVersion <= '18';

    return isLegacyEdge ? 'legacy-edge' : 'edge';
  }

  if (formattedName.endsWith('-mobile')) {
    return formattedName.split('-')[0];
  }

  return formattedName;
}
