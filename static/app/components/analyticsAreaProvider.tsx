import {createContext, type ReactNode, useContext} from 'react';

export const AnalyticsAreaContext = createContext<string>('');

/**
 * Use this component to provide context on the UI area an analytics event is
 * emitted from. It may also be used for metadata like queryReferrers, but app
 * logic should not change/branch off of this context. To get the current Area
 * (a string), call `useContext(AnalyticsAreaContext)`.
 *
 * The `name` of an AnalyticsAreaProvider should be unique from other instances
 * of this component, to ensure each area uniquely identifies part of the UI.
 * By default, when nesting this component, we recursively append `name` to the
 * outer AnalyticsAreaContext, with "." as a separator. Use `overrideParent=true`
 * to ignore the outer context.
 *
 * @example
 * ```
 * <AnalyticsAreaProvider name="feedback">
 *   ...
 *     <AnalyticsAreaProvider name="details">
 *       trackAnalytics('my-analytic', {area: useContext(AnalyticsAreaContext)})  // area = "feedback.details"
 *     </AnalyticsAreaProvider>
 *   ...
 * </AnalyticsAreaProvider>
 * ```
 *
 * @example
 * ```
 * <AnalyticsAreaProvider name="feedback">
 *     <AnalyticsAreaProvider name="my-modal" overrideParent={true}>
 *       trackAnalytics('my-analytic', {area: useContext(AnalyticsAreaContext)})  // area = "my-modal"
 *     </AnalyticsAreaProvider>
 * </AnalyticsAreaProvider>
 * ```
 */
export default function AnalyticsAreaProvider({
  children,
  name,
  overrideParent = false,
}: {
  children: ReactNode;
  name: string;
  overrideParent?: boolean;
}) {
  const parentArea = useContext(AnalyticsAreaContext);
  const area = overrideParent || !parentArea ? name : `${parentArea}.${name}`;

  return (
    <AnalyticsAreaContext.Provider value={area}>{children}</AnalyticsAreaContext.Provider>
  );
}
