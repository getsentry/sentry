// Attempts to get a display name from a Component
//
// Use for HoCs
export default function getDisplayName<Props = {}>(
  WrappedComponent: React.ComponentType<Props>
): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}
