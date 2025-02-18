## Contexts (Feb 2025)

[Contexts](https://docs.sentry.io/platform-redirect/?next=/enriching-events/context/) are a way that Sentry users and SDKs can add supplemental data to an event to aid in debugging. They are stored in the `contexts` field in the event payload, and rendered on the issue details page under the `Contexts` section.

Contexts are added to events in the SDK, so if you are looking to extend the source data in any way,
you should check out the [SDK Documentation](https://develop.sentry.dev/sdk/data-model/event-payloads/contexts/).

If you have already added the context in the SDK, but want to render it in a recognized format in the UI, this document outlines that process.

### Adding New Context

All context in Sentry currently has three types:

- Raw (unformatted from the user, ignored in this document)
- Known (common context across SDKs, where key names are displayed in user-friendly language, i.e. `browser`, `device`, `os`)
- Platform (context specific to a platform, i.e. `laravel`, `react`, `unity`)

To add a new context to the list of _Known_ or _Platform_ contexts, the steps are mostly the same:

1. Create a new file in the relevant directory (`knownContext` or `platformContext`)
2. Build out a key enum, and interface for the context (e.g. `CultureContextKeys` and `CultureContext`)

```ts
enum MyContextKeys {
  AGE = 'age',
  SLUG = 'slug',
}

export interface MyContext {
  // It's common to allow custom keys in case the user sets something on the context manually
  [key: string]: any;
  [MyContextKeys.AGE]?: number;
  [MyContextKeys.SLUG]?: string;
}
```

3. Implement and export the getter function for the context (e.g. `getCultureContextData`). It should take in the context dictionary and `meta` (which is the metadata for the context, which is used for redacting data), and return `KeyValueListData`. A helpful utility function is `getContextKeys`, which returns an array of the keys in the context for switch/case statements.

```tsx
export function getMyContextData({
  data,
  meta,
}: {
  data: MyContext;
  meta: Record<keyof MyContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case MyContextKeys.AGE:
        return {
          key: ctxKey,
          subject: t('User Age'),
          value: tct('[age] years old', {age: data[MyContextKeys.AGE]}),
          meta: meta?.[ctxKey]?.[''],
        };
      case MyContextKeys.SLUG:
        return {
          key: ctxKey,
          subject: t('User Slug'),
          value: <MyCustomSlugRenderer slug={data[MyContextKeys.SLUG]} />,
          meta: meta?.[ctxKey]?.[''],
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
```

4. If you are adding a new _known_ context, modify the `EventContexts` enum in `app/types/event.tsx` to include the new context. The key should be the same one being set by the SDK.For platform contexts, skip this step.

```ts
export type EventContexts = {
    browser?: BrowserContext;
  'Current Culture'?: CultureContext;
  ...
  my_context?: MyContext;
};
```

5. Add the new context to the relevant utility function (`getFormattedContextData` or `getPlatformContextData`). This will trigger your function from Step 3 to be called when the event payload contains the `key` you specify (which should match the key from Step 4 if adding a known context, but the types are a bit loose).

```ts
export function getFormattedContextData({...}) {
    switch (contextType) {
        case 'my_context':
            return getMyContextData({data: contextValue, meta});
        ...
    }
}
```

6. To add an icon for the context, add a new case to the `getContextIcon` or `getPlatformContextIcon` function. The `generateIconName` utility is useful for company logos.

```tsx
export function getContextIcon({...}) {
    switch (type) {
        case 'my_context':
            return <img src={"my-logo.svg"} size={iconSize} />
            ...
```

7. Add a test for the new context. Copying an existing test is the best way to get started, but some common usecases to test are custom formatting or titles, redacted data, and that user-specified keys are still rendered.
