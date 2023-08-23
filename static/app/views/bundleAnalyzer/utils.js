export function isChunkParsed(chunk) {
  return typeof chunk.parsedSize === 'number';
}

export function walkModules(modules, cb) {
  for (const module of modules) {
    if (cb(module) === false) {
      return false;
    }

    if (module.groups) {
      if (walkModules(module.groups, cb) === false) {
        return false;
      }
    }
  }
  return undefined;
}

export function elementIsOutside(elem, container) {
  return !(elem === container || container.contains(elem));
}
