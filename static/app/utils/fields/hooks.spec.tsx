import {ATTRIBUTE_METADATA} from '@sentry/conventions';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  FieldKind,
  FieldValueType,
  getConventionsFallbackFieldDefinition,
} from 'sentry/utils/fields';
import {useAttributeMappings, useFieldDefinitionGetter} from 'sentry/utils/fields/hooks';

const findConventionsOnlyKey = () => {
  // Find a key that exists in ATTRIBUTE_METADATA and has a conventions fallback
  const keys = Object.keys(ATTRIBUTE_METADATA);
  return keys.find(key => {
    const fallback = getConventionsFallbackFieldDefinition(key, FieldKind.TAG);
    return fallback !== null;
  });
};

describe('useAttributeMappings', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches attribute mappings without type', async () => {
    const mappings = [
      {
        internalName: 'trace_id',
        publicAlias: 'trace.id',
        searchType: 'string',
        type: 'spans',
      },
    ];
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/attribute-mappings/`,
      body: {data: mappings},
    });

    const {result} = renderHookWithProviders(() => useAttributeMappings(), {
      organization,
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    await waitFor(() => expect(result.current.data?.data).toEqual(mappings));

    expect(mock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/attribute-mappings/`,
      expect.anything()
    );
  });

  it('fetches attribute mappings with type filter', async () => {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/attribute-mappings/`,
      body: {data: []},
    });

    const {result} = renderHookWithProviders(
      () => useAttributeMappings({type: 'spans'}),
      {
        organization,
      }
    );

    await waitFor(() => expect(result.current.data).toBeDefined());
    await waitFor(() => expect(result.current.data?.data).toEqual([]));
    expect(mock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/attribute-mappings/`,
      expect.objectContaining({
        query: {type: 'spans'},
      })
    );
  });
});

describe('useFieldDefinitionGetter', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('falls back to conventions when no mappings are returned', async () => {
    const conventionsOnlyKey = findConventionsOnlyKey();
    expect(conventionsOnlyKey).toBeDefined();
    if (!conventionsOnlyKey) {
      return;
    }

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/attribute-mappings/`,
      body: {data: []},
    });

    const {result} = renderHookWithProviders(() => useFieldDefinitionGetter(), {
      organization,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const definition = result.current.getFieldDefinition(
      conventionsOnlyKey,
      'log',
      FieldKind.TAG
    );
    const fallback = getConventionsFallbackFieldDefinition(
      conventionsOnlyKey,
      FieldKind.TAG
    );

    expect(definition).toMatchObject(fallback ?? {});
  });

  it('skips conventions fallback for internally mapped keys', async () => {
    const conventionsOnlyKey = findConventionsOnlyKey();
    expect(conventionsOnlyKey).toBeDefined();
    if (!conventionsOnlyKey) {
      return;
    }

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/attribute-mappings/`,
      body: {
        data: [
          {
            internalName: conventionsOnlyKey,
            publicAlias: `public.${conventionsOnlyKey}`,
            searchType: 'string',
            type: 'logs',
          },
        ],
      },
    });

    const {result} = renderHookWithProviders(() => useFieldDefinitionGetter(), {
      organization,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    const definition = result.current.getFieldDefinition(
      conventionsOnlyKey,
      'log',
      FieldKind.TAG
    );

    expect(definition).toStrictEqual({
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
    });
  });
});
