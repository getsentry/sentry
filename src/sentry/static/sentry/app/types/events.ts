export interface Thread {
  id: string;
  name?: string;
  crashed: boolean;
  stacktrace?: any;
}
