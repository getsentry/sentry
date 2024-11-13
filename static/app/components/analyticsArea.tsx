import {createContext, type ReactNode, useContext} from 'react';

const AnalyticsAreaContext = createContext<string>('');

/**
 * Returns a string identifying the UI area from which an analytics event is emitted.
 * This may also be used for metadata like queryReferrers, but app logic should
 * not change or branch off of this value.
 */
export function useAnalyticsArea(): string {
  return useContext(AnalyticsAreaContext);
}

/**
 * Used to provide context on the UI area from which an analytics event is emitted.
 * When nesting this component, we recursively append `name` to the outer
 * AnalyticsArea, so the area becomes `${outer}.${name}`. Use
 * `overrideParent` to strip the outer value.
 *
 * To ensure each area uniquely identifies part of the UI, avoid duplicating
 * `name` in top-level areas - and generally, as much as possible.
 *
 * @example
 * ```
 * <AnalyticsArea name="feedback">
 *   ...
 *     <AnalyticsArea name="details">
 *       trackAnalytics('my-analytic', {area: useAnalyticsArea()})  // area = "feedback.details"
 *     </AnalyticsArea>
 *   ...
 * </AnalyticsArea>
 * ```
 *
 * @example
 * ```
 * <AnalyticsArea name="feedback">
 *     <AnalyticsArea name="my-modal" overrideParent={true}>
 *       trackAnalytics('my-analytic', {area: useAnalyticsArea()})  // area = "my-modal"
 *     </AnalyticsArea>
 * </AnalyticsArea>
 * ```
 */
export default function AnalyticsArea({
  children,
  name,
  overrideParent = false,
}: {
  children: ReactNode;
  name: string;
  overrideParent?: boolean;
}) {
  const parentArea = useAnalyticsArea();
  const area = overrideParent || !parentArea ? name : `${parentArea}.${name}`;

  return (
    <AnalyticsAreaContext.Provider value={area}>{children}</AnalyticsAreaContext.Provider>
  );
}
