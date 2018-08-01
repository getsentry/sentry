// Attempts to get a display name from a Component
//
// Use for HoCs
export default function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}
