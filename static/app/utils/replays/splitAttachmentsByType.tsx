export default function splitAttachmentsByType(attachments: any[]) {
  const rawBreadcrumbs = [] as unknown[];
  const rawRRWebEvents = [] as unknown[];
  const rawNetworkSpans = [] as unknown[];
  const rawMemorySpans = [] as unknown[];

  attachments.forEach(attachment => {
    if (attachment.data?.tag === 'performanceSpan') {
      const span = attachment.data?.payload;
      if (span.op === 'memory') {
        rawMemorySpans.push(span);
      }
      if (span.op?.startsWith('navigation.') || span.op?.startsWith('resource.')) {
        rawNetworkSpans.push(span);
      }
    } else if (attachment.data?.tag === 'breadcrumb') {
      rawBreadcrumbs.push(attachment?.data?.payload);
    } else {
      rawRRWebEvents.push(attachment);
    }
  });

  return {
    rawBreadcrumbs,
    rawRRWebEvents,
    rawNetworkSpans,
    rawMemorySpans,
  };
}
