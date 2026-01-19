import fs from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {compile} from '@mdx-js/mdx';
import type {Compiler, RspackPluginInstance} from '@rspack/core';
import rspack from '@rspack/core';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import {parse as parseFrontmatter} from 'ultramatter';

type Options = {
  basePath: string;
};

type IndexEntry = {
  frontmatter: any | undefined;
  content?: string;
};

type EntryCache = Map<
  string,
  {
    mtime: number;
    entry: IndexEntry;
  }
>;

// Create virtual file in app directory so it's resolvable via 'sentry' alias
const VIRTUAL_MODULE_PATH = 'app/virtual/stories-index.js';

class StoriesIndexPlugin implements RspackPluginInstance {
  baseURL: URL;
  cache: EntryCache;
  virtualModulesPlugin: InstanceType<typeof rspack.experiments.VirtualModulesPlugin>;
  generatedIndex: string | null;

  constructor({basePath}: Options) {
    // Ensure basePath ends with separator for proper URL construction
    const normalizedPath = basePath.endsWith('/') ? basePath : basePath + '/';
    this.baseURL = pathToFileURL(normalizedPath);
    this.cache = new Map();
    this.generatedIndex = null;
    console.log(`[StoriesIndexPlugin] Initialized with basePath: ${basePath}`);
    console.log(`[StoriesIndexPlugin] Base URL: ${this.baseURL.href}`);
    // Create the virtual modules plugin instance with initial empty index
    this.virtualModulesPlugin = new rspack.experiments.VirtualModulesPlugin({
      [VIRTUAL_MODULE_PATH]: 'export default {};',
    });
  }

  apply(compiler: Compiler) {
    // Apply the virtual modules plugin
    this.virtualModulesPlugin.apply(compiler);

    // Clear cache in watch mode to force re-scan
    compiler.hooks.watchRun.tapAsync('StoriesIndexPlugin', async (_, callback) => {
      this.cache.clear();
      this.generatedIndex = null;

      // Regenerate index in watch mode
      try {
        const index = await this.generateIndex();
        this.generatedIndex = `export default ${JSON.stringify(index)};`;
        console.log(
          `[StoriesIndexPlugin] Regenerated stories search index with ${Object.keys(index).length} entries`
        );
        callback();
      } catch (error) {
        callback(error as Error);
      }
    });

    // Generate stories search index before compilation starts (async)
    compiler.hooks.beforeCompile.tapAsync('StoriesIndexPlugin', async (_, callback) => {
      try {
        const index = await this.generateIndex();
        this.generatedIndex = `export default ${JSON.stringify(index)};`;

        console.log(
          `[StoriesIndexPlugin] Generated stories search index with ${Object.keys(index).length} entries`
        );
        callback();
      } catch (error) {
        console.error(`[StoriesIndexPlugin] Error generating index:`, error);
        callback(error as Error);
      }
    });

    // Write the virtual module after Rust compiler is initialized (sync)
    compiler.hooks.thisCompilation.tap('StoriesIndexPlugin', () => {
      if (this.generatedIndex) {
        this.virtualModulesPlugin.writeModule(VIRTUAL_MODULE_PATH, this.generatedIndex);
      }
    });
  }

  private async generateIndex(): Promise<Record<string, IndexEntry>> {
    const appURL = new URL('app/', this.baseURL);
    console.log(
      `[StoriesIndexPlugin] Scanning for MDX files in: ${fileURLToPath(appURL)}`
    );

    const mdxFiles = await this.findMDXFiles(appURL);
    console.log(`[StoriesIndexPlugin] Found ${mdxFiles.length} MDX files`);

    const results = await Promise.all(
      mdxFiles.map(async fileURL => {
        // Calculate relative path for the index key
        const relativePath = fileURL.pathname
          .replace(this.baseURL.pathname, '')
          .replace(/^\//, '');

        const entry = await this.extractEntryWithCache(fileURL);
        return [relativePath, entry] as const;
      })
    );

    return Object.fromEntries(results);
  }

  private async findMDXFiles(dirURL: URL): Promise<URL[]> {
    const results: URL[] = [];
    // Convert to path only for fs.promises.glob
    const dirPath = fileURLToPath(dirURL);
    console.log(`[StoriesIndexPlugin] Globbing in directory: ${dirPath}`);

    try {
      for await (const entry of fs.promises.glob(
        ['*.mdx', '**/*.mdx', '!node_modules', '!.*'],
        {cwd: dirPath}
      )) {
        // entry is a relative path string, construct proper URL
        // Ensure dirURL ends with '/' before constructing relative URL
        const baseURL = dirURL.href.endsWith('/') ? dirURL : new URL(dirURL.href + '/');
        results.push(new URL(entry, baseURL));
      }
    } catch (error) {
      console.error(`[StoriesIndexPlugin] Error during glob:`, error);
    }

    console.log(`[StoriesIndexPlugin] Glob found ${results.length} files`);
    return results;
  }

  private async extractEntryWithCache(fileURL: URL): Promise<IndexEntry> {
    try {
      // Convert to path for fs operations
      const filePath = fileURLToPath(fileURL);
      const stats = await fs.promises.stat(filePath);
      const cached = this.cache.get(fileURL.href);

      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.entry;
      }

      const entry = await this.extractEntry(fileURL);
      this.cache.set(fileURL.href, {mtime: stats.mtimeMs, entry});
      return entry;
    } catch (error) {
      console.warn(`Failed to process ${fileURL.href}:`, error);
      return {frontmatter: undefined, content: undefined};
    }
  }

  private async extractEntry(fileURL: URL): Promise<IndexEntry> {
    try {
      // Convert to path for fs.readFile
      const filePath = fileURLToPath(fileURL);
      const source = await fs.promises.readFile(filePath, 'utf-8');

      let frontmatter: any = undefined;

      // Custom remark plugin to capture frontmatter from tree data
      const captureFrontmatter = () => {
        return (_tree: any, file: any) => {
          console.log(file);
          // remark-mdx-frontmatter stores frontmatter in file.data.frontmatter
          if (file.data?.frontmatter) {
            frontmatter = file.data.frontmatter;
          }
        };
      };

      await compile(source, {
        remarkPlugins: [captureFrontmatter, remarkFrontmatter, remarkMdxFrontmatter],
      });

      return {
        frontmatter,
        content: undefined,
        // content: source,
      };
    } catch (error) {
      console.warn(`Failed to extract from ${fileURL.href}:`, error);
      return {frontmatter: undefined, content: ''};
    }
  }
}

export default StoriesIndexPlugin;
