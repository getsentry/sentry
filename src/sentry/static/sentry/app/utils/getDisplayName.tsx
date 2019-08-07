// Attempts to get a display name from a Component
//
// Use for HoCs
export default function getDisplayName(WrappedComponent: React.ComponentType): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}
