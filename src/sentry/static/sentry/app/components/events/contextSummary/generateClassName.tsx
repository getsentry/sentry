import {defined} from 'app/utils';

function generateClassname(name?: string): string {
  if (!defined(name)) {
    return '';
  }

  // amazon fire tv device id changes with version: AFTT, AFTN, AFTS, AFTA, AFTVA (alexa), ...
  if (name.toLowerCase().startsWith('aft')) {
    return 'amazon';
  }

  return name
    .split(/\d/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/\-+$/, '')
    .replace(/^\-+/, '');
}

export default generateClassname;
