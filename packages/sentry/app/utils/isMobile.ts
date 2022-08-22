/**
 * Checks if the user agent is a mobile device. On browsers that does not support `navigator.userAgentData`,
 * fallback to checking the viewport width.
 */
export default function isMobile(): boolean {
  if ((navigator as any).userAgentData) {
    return (navigator as any).userAgentData.mobile;
  }
  return window.innerWidth < 800;
}
