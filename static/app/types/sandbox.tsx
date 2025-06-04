export type SandboxData = {
  acceptedTracking?: boolean;
  cta?: {
    id: string;
    shortTitle: string;
    title: string;
    url: string;
  };
  extraQueryString?: string;
  skipEmail?: boolean;
};

declare global {
  interface Window {
    SandboxData?: SandboxData;
  }
}
