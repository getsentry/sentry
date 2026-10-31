/* eslint-disable import/no-nodejs-modules */
import {Buffer} from 'node:buffer';
import {createHash} from 'node:crypto';

import {rspack} from '@rsbuild/core';
import type {Compiler, Module} from '@rspack/core';

/** Include styles from lazy chunks in the existing global stylesheet. */
export class YakCssPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap('YakCssPlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {name: 'YakCssPlugin', stage: rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS},
        () => {
          const styles = compilation
            .getAssets()
            .filter(asset => asset.name.startsWith('.yak-css/'));
          if (!styles.length) return;
          const assets = new Map(styles.map(asset => [asset.name, asset]));
          const owners = new Map<string, {module: Module; styles: typeof styles}>();
          for (const module of compilation.modules) {
            const encoded = module
              .identifier()
              .match(/data:text\/css;base64,([A-Za-z0-9+/=]+)/)?.[1];
            if (!encoded) continue;
            const hash = createHash('sha256')
              .update(Buffer.from(encoded, 'base64'))
              .digest('hex');
            const asset = assets.get('.yak-css/' + hash + '.css');
            const issuer = compilation.moduleGraph.getIssuer(module);
            if (asset && issuer) {
              const id = issuer.identifier();
              const owner = owners.get(id) ?? {module: issuer, styles: []};
              owner.styles.push(asset);
              owners.set(id, owner);
            }
          }
          // Order CSS owners by their imports, through intermediate modules.
          // A wrapper follows its base even when a barrel creates a JS cycle.
          const ordered: typeof styles = [];
          const emitted = new Set<string>();
          const visitedOwners = new Set<string>();
          const visitOwner = (id: string) => {
            if (visitedOwners.has(id)) return;
            visitedOwners.add(id);
            const owner = owners.get(id)!;
            const visited = new Set<string>([id]);
            const visitDependencies = (module: Module) => {
              for (const connection of compilation.moduleGraph.getOutgoingConnectionsInOrder(
                module
              )) {
                const dependency = connection.module;
                if (!dependency) continue;
                const depId = dependency.identifier();
                if (visited.has(depId)) continue;
                visited.add(depId);
                if (owners.has(depId)) visitOwner(depId);
                else visitDependencies(dependency);
              }
            };
            visitDependencies(owner.module);
            for (const asset of owner.styles) {
              if (!emitted.has(asset.name)) {
                emitted.add(asset.name);
                ordered.push(asset);
              }
            }
          };
          for (const id of [...owners.keys()].sort()) visitOwner(id);
          if (ordered.length !== styles.length)
            throw new Error('Some Yak styles have no importing module');
          const target = 'entrypoints/sentry.css';
          const existing = compilation.getAsset(target);
          if (!existing) throw new Error('Yak styles require ' + target);
          compilation.updateAsset(
            target,
            new rspack.sources.ConcatSource(
              existing.source,
              '\n/* Yak extracted styles */\n',
              ...ordered.map(asset => asset.source)
            )
          );
          for (const asset of styles) compilation.deleteAsset(asset.name);
        }
      );
    });
  }
}
