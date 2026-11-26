/**
 * Generate the TypeScript client and the optional Valibot and Zod schemas
 * from the OpenAPI spec with Hey API.
 *
 * The validator plugins read nothing the TypeScript and SDK plugins write, so
 * each group runs in its own worker thread, and each produces the same files
 * it would in one combined run. Hey API empties its output directory first,
 * so the validator groups write to a temporary directory and their files are
 * copied into the output afterwards.
 */
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker, workerData } from "node:worker_threads";

/**
 * Hey API attaches descriptions only to typed schemas, not to unions, so an
 * OpenAPI 3.0 `nullable` field (a union with `null` in its IR) loses its
 * description. Give the field's one non-null branch the description instead.
 */
function describeNullableValues(ir) {
  const seen = new WeakSet();
  const visit = node => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (node.logicalOperator === "or" && node.description && Array.isArray(node.items)) {
      const values = node.items.filter(item => item.type !== "null");
      if (values.length === 1 && values.length < node.items.length) {
        values[0].description ??= node.description;
      }
    }
    Object.values(node).forEach(visit);
  };
  visit(ir);
}

/** Whether a union keeps two or more non-null members, so it emits a union node. */
const isUnionOfValues = ({ schemas }) => schemas.filter(schema => schema.type !== "null" && schema.const !== null).length > 1;

/**
 * Hey API applies `metadata` only to typed schemas, so an `anyOf` or `oneOf`
 * union loses its own description. Attach it to the union node, the way
 * `metadata` does for typed schemas. Unions with one non-null member emit that
 * member, which describeNullableValues has already described.
 */
const unionResolvers = {
  valibot: {
    union(ctx) {
      const base = ctx.nodes.base(ctx);
      if (base) ctx.pipes.push(ctx.pipes.current, base);
      const { description } = ctx.parentSchema;
      if (description && isUnionOfValues(ctx)) {
        const metadata = ctx.$.object().prop("description", ctx.$.literal(description));
        ctx.pipes.push(ctx.pipes.current, ctx.$(ctx.symbols.v).attr("metadata").call(metadata));
      }
      return ctx.pipes.current;
    },
  },
  zod: {
    union(ctx) {
      const base = ctx.nodes.base(ctx);
      const { description } = ctx.parentSchema;
      if (!description || !isUnionOfValues(ctx)) return base;
      const metadata = ctx.$.object().pretty().prop("description", ctx.$.literal(description));
      return base.attr("register").call(ctx.$(ctx.symbols.z).attr("globalRegistry"), metadata);
    },
  },
};

// `metadata: true` attaches each OpenAPI description to its schema, so
// consumers can read field descriptions at runtime.
// Since 0.95, validators only compose request schemas when another plugin asks
// for them. Keep our public *Data exports without enabling SDK validation.
const validatorOptions = {
  metadata: true,
  requests: { shouldExtract: true },
  "~hooks": {
    events: {
      "plugin:handler:before": ({ plugin }) => describeNullableValues(plugin.context.ir),
      "plugin:handler:after": ({ plugin }) => {
        plugin.forEach("operation", ({ operation }) => {
          plugin.api.createRequestSchema({ operation, plugin });
        });
      },
    },
  },
};

// When `plugins` is specified, the defaults (TypeScript + SDK + client) are no
// longer implicit, so the first group lists them explicitly.
const PLUGIN_GROUPS = {
  client: ["@hey-api/typescript", "@hey-api/sdk"],
  valibot: [{ name: "valibot", ...validatorOptions, "~resolvers": unionResolvers.valibot }],
  // Hey API infers Zod 4 output from the `zod` peer range.
  zod: [{ name: "zod", ...validatorOptions, "~resolvers": unionResolvers.zod }],
};

function runGroup(input, output, group) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { heyApi: { input, output, group } } });
    worker.once("error", reject);
    worker.once("exit", code => code === 0 ? resolve() : reject(new Error(`Hey API ${group} worker exited with code ${code}`)));
  });
}

/** Write the client into `output`, and the validator schemas next to it. */
export async function generateClient(input, output) {
  const scratch = mkdtempSync(join(tmpdir(), "sentry-api-hey-"));
  try {
    const runs = Object.keys(PLUGIN_GROUPS).map(group => ({ group, dir: group === "client" ? output : join(scratch, group) }));
    await Promise.all(runs.map(({ group, dir }) => runGroup(input, dir, group)));
    for (const { dir } of runs.filter(run => run.dir !== output)) {
      for (const name of readdirSync(dir)) cpSync(join(dir, name), join(output, name), { recursive: true });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (workerData?.heyApi) {
  const { input, output, group } = workerData.heyApi;
  const { createClient } = await import("@hey-api/openapi-ts");
  await createClient({ input, output, plugins: PLUGIN_GROUPS[group] });
}
