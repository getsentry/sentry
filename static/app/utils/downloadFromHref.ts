export function downloadFromHref(filename: string, href: string) {
  const link = document.createElement('a');
  link.setAttribute('href', href);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
}
