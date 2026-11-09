import { describe, expect, test } from "vitest";
import { extractDocs, operations, tags } from "@sentry/api/docs";
import { readFileSync } from "node:fs";

const fixture = {
  openapi: "3.0.3",
  info: { title: "API reference", version: "1" },
  tags: [
    { name: "Teams", description: "Manage teams.", "x-display-description": true },
    { name: "Organizations", "x-sidebar-name": "Orgs" },
  ],
  paths: {
    "/api/0/organizations/{organization_id_or_slug}/teams/": {
      parameters: [
        { name: "organization_id_or_slug", in: "path", required: true, description: "The org.", schema: { type: "string" } },
        { name: "detailed", in: "query", schema: { type: "string" } },
      ],
      get: {
        operationId: "List an Organization's Teams",
        summary: "(DEPRECATED) List teams ",
        description: "Return teams.\n",
        tags: ["Teams"],
        deprecated: true,
        security: [{ auth_token: ["team:read"] }],
        parameters: [
          { name: "detailed", in: "query", description: "Overrides the path-level one.", "x-sentry-experimental": true, schema: { type: "string", enum: ["0", "1"] } },
        ],
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": {
                schema: { type: "array", items: { type: "object" } },
                example: [{ slug: "web" }],
              },
            },
          },
          "403": { description: "Forbidden" },
        },
      },
      post: {
        operationId: "Create a Team",
        tags: ["Teams"],
        "x-sentry-experimental": true,
        servers: [{ url: "https://us.sentry.io" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["slug"], properties: { slug: { type: "string", description: "Team slug." } } },
              example: { slug: "web" },
            },
            "multipart/form-data": { schema: { type: "object" } },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { type: "object" },
                examples: { created: { summary: "A team", value: { slug: "web" } } },
              },
            },
          },
        },
      },
    },
  },
};

describe("API reference data", () => {
  test("copies what a reference page shows, in specification order", () => {
    expect(extractDocs(fixture)).toEqual({
      tags: [
        { name: "Teams", description: "Manage teams.", displayDescription: true },
        { name: "Organizations", sidebarName: "Orgs", displayDescription: false },
      ],
      operations: [
        {
          operationId: "List an Organization's Teams",
          method: "GET",
          path: "/api/0/organizations/{organization_id_or_slug}/teams/",
          summary: "(DEPRECATED) List teams ",
          description: "Return teams.\n",
          tags: ["Teams"],
          deprecated: true,
          experimental: false,
          servers: [],
          security: [{ auth_token: ["team:read"] }],
          parameters: [
            { name: "organization_id_or_slug", in: "path", required: true, description: "The org.", experimental: false, schema: { type: "string" } },
            { name: "detailed", in: "query", required: false, description: "Overrides the path-level one.", experimental: true, schema: { type: "string", enum: ["0", "1"] } },
          ],
          responses: [
            {
              status: "200",
              description: "Success",
              contentType: "application/json",
              schema: { type: "array", items: { type: "object" } },
              example: [{ slug: "web" }],
            },
            { status: "403", description: "Forbidden" },
          ],
        },
        {
          operationId: "Create a Team",
          method: "POST",
          path: "/api/0/organizations/{organization_id_or_slug}/teams/",
          description: "",
          tags: ["Teams"],
          deprecated: false,
          experimental: true,
          servers: ["https://us.sentry.io"],
          security: [],
          parameters: [
            { name: "organization_id_or_slug", in: "path", required: true, description: "The org.", experimental: false, schema: { type: "string" } },
            { name: "detailed", in: "query", required: false, experimental: false, schema: { type: "string" } },
          ],
          requestBody: {
            contentType: "application/json",
            required: true,
            schema: { type: "object", required: ["slug"], properties: { slug: { type: "string", description: "Team slug." } } },
            example: { slug: "web" },
          },
          responses: [
            {
              status: "201",
              description: "Created",
              contentType: "application/json",
              schema: { type: "object" },
              examples: { created: { summary: "A team", value: { slug: "web" } } },
            },
          ],
        },
      ],
    });
  });

  describe("the published export", () => {
    const spec = JSON.parse(readFileSync(new URL("../spec/openapi-derefed.json", import.meta.url), "utf8"));
    const sourceOperations = Object.entries(spec.paths).flatMap(([path, pathItem]) =>
      Object.entries(pathItem as Record<string, Record<string, any>>).map(([method, operation]) => ({ path, method, operation })),
    );

    test("is built from this release's spec", () => {
      expect({ tags, operations }).toEqual(extractDocs(spec));
    });

    test("covers every tag and operation the spec documents", () => {
      expect(tags.map(tag => tag.name)).toEqual(spec.tags.map((tag: { name: string }) => tag.name));
      expect(operations.map(operation => `${operation.method} ${operation.path}`)).toEqual(
        sourceOperations.map(({ path, method }) => `${method.toUpperCase()} ${path}`),
      );
    });

    test("keeps each operation's text, parameters, examples and responses as the spec writes them", () => {
      operations.forEach((operation, index) => {
        const source = sourceOperations[index]!.operation;
        const media = (content: object | undefined) => Object.values(content ?? {})[0];
        expect(operation.operationId).toBe(source.operationId);
        expect(operation.summary).toBe(source.summary);
        expect(operation.description).toBe(source.description ?? "");
        expect(operation.parameters.map(({ name, in: location }) => `${location} ${name}`)).toEqual(
          (source.parameters ?? []).map((parameter: { name: string; in: string }) => `${parameter.in} ${parameter.name}`),
        );
        expect(operation.requestBody?.example).toEqual(media(source.requestBody?.content)?.example);
        expect(operation.requestBody?.schema).toEqual(media(source.requestBody?.content)?.schema);
        expect(operation.responses.map(response => response.status)).toEqual(Object.keys(source.responses));
        operation.responses.forEach(response => {
          const sourceMedia = media(source.responses[response.status].content);
          expect(response.schema).toEqual(sourceMedia?.schema);
          expect(response.example ?? response.examples).toEqual(sourceMedia?.example ?? sourceMedia?.examples);
        });
      });
    });
  });
});
