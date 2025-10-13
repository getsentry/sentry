export type TraceElement = HTMLElement | SVGElement;

export function isTraceElement(el: unknown): el is TraceElement {
  return el instanceof HTMLElement || el instanceof SVGElement;
}

export function getComponentName(el: unknown): string {
  if (!isTraceElement(el)) return 'unknown';
  return el.dataset.sentryComponent || el.dataset.sentryElement || 'unknown';
}

export function getSourcePath(el: unknown): string {
  if (!isTraceElement(el)) return 'unknown path';
  return el.dataset.sentrySourcePath?.split(/static\//)[1] || 'unknown path';
}

export const getFileName = (path: string) => {
  return (path.split('/').pop()?.toLowerCase() || '')
    .replace(/\.stories\.tsx$/, '')
    .replace(/\.tsx$/, '')
    .replace(/\.mdx$/, '');
};

export function getComponentStorybookFile(
  el: unknown,
  stories: Record<string, string>
): string | null {
  const sourcePath = getSourcePath(el);
  if (!sourcePath) return null;

  const mdxSourcePath = sourcePath.replace(/\.tsx$/, '.mdx');

  if (stories[mdxSourcePath] && getFileName(mdxSourcePath) === getFileName(sourcePath)) {
    return mdxSourcePath;
  }

  const tsxSourcePath = sourcePath.replace(/\.tsx$/, '.stories.tsx');
  if (stories[tsxSourcePath] && getFileName(tsxSourcePath) === getFileName(sourcePath)) {
    return tsxSourcePath;
  }

  return stories[sourcePath] || null;
}

export function isCoreComponent(el: unknown): boolean {
  if (!isTraceElement(el)) return false;
  return el.dataset.sentrySourcePath?.includes('app/components/core') ?? false;
}

export function isViewComponent(el: unknown): boolean {
  if (!isTraceElement(el)) return false;
  return el.dataset.sentrySourcePath?.includes('app/views') ?? false;
}

export function getSourcePathFromMouseEvent(event: MouseEvent): TraceElement[] | null {
  if (!event.target || !isTraceElement(event.target)) return null;

  const target = event.target;

  let head = target.dataset.sentrySourcePath
    ? target
    : target.closest('[data-sentry-source-path]');

  if (!head) return null;

  const trace: TraceElement[] = [head as TraceElement];

  head = head.parentElement;

  while (head) {
    const next = head.parentElement?.closest(
      '[data-sentry-source-path]'
    ) as TraceElement | null;
    if (!next || next === head) break;
    trace.push(next);
    head = next;
  }

  return trace;
}
