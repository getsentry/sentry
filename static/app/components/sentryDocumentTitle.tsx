import * as React from 'react';
import DocumentTitle from 'react-document-title';

type Props = {
  title?: string;
  orgSlug?: string;
  projectSlug?: string;
  children?: React.ReactChild;
};

function SentryDocumentTitle({title, orgSlug, projectSlug, children}: Props) {
  function getPageTitle() {
    if (!orgSlug && !projectSlug) {
      return title;
    }

    if (orgSlug && projectSlug) {
      return `${title} - ${orgSlug} - ${projectSlug}`;
    }

    if (orgSlug) {
      return `${title} - ${orgSlug}`;
    }

    return `${title} - ${projectSlug}`;
  }

  const pageTitle = getPageTitle();
  const documentTitle = pageTitle ? `${pageTitle} - Sentry` : 'Sentry';

  return <DocumentTitle title={documentTitle}>{children}</DocumentTitle>;
}

export default SentryDocumentTitle;
