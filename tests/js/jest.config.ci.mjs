import {createJestConfig} from './createJestConfig.ts';

// Discover one global list for CI sharding. Workspace configs run their selected
// files in separate Jest processes; the root watcher also uses this combined config.
export default createJestConfig();
