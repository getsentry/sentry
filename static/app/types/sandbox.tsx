export type SandboxData = {
  skipEmail?: boolean;
  acceptedTracking?: boolean;
  extraQueryString?: string;
  cta?: {
    id: string;
    title: string;
    shortTitle: string;
    url: string;
  };
};

declare global {
  interface Window {
    SandboxData?: SandboxData;
  }
}
