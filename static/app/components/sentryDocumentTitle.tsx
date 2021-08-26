import * as React from 'react';
import DocumentTitle from 'react-document-title';

type Props = {
  // Main page title
  title: string;
  orgSlug?: string;
  projectSlug?: string;
  children?: React.ReactNode;
};

function SentryDocumentTitle({title, orgSlug, projectSlug, children}: Props) {
  function getDocTitle() {
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

  const docTitle = getDocTitle();

  return (
    <DocumentTitle title={`${docTitle} - Sentry`}>
      {children as React.ReactChild}
    </DocumentTitle>
  );
}

export default SentryDocumentTitle;
